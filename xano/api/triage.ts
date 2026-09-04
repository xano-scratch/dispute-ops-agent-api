import { query, input, s, c, ref, inp, auth, expr, col, and } from "@xanots/sdk";
import { disputeApi } from "./dispute.js";
import { disputeTriageAgent } from "../agents/dispute_triage_agent.js";
import { operators } from "../tables/operators.js";
import { transactions } from "../tables/transactions.js";
import { decision_rules } from "../tables/decision_rules.js";
import { disputes } from "../tables/disputes.js";
import { agent_runs } from "../tables/agent_runs.js";
import { dispute_actions } from "../tables/dispute_actions.js";

/**
 * The AI agent endpoint (Play 4). `s.ai.agent.run` classifies the dispute and
 * proposes a resolution inside the policy the endpoint reads for it. It PROPOSES
 * only: it records an `agent_runs` row and a `propose` action tagged `agent`, and
 * never writes the final resolution.
 *
 * The proposed payout is derived deterministically from the proposed resolution
 * (refund/partial -> the dispute amount, deny -> 0), never taken from the model,
 * so a stray model output cannot slip a payout past the ceiling check. When that
 * payout is over the rule ceiling the run is still recorded, flagged
 * `allowed = false` with the reason.
 */
export const triageQuery = query({
  name: "triage",
  verb: "POST",
  apiGroup: disputeApi,
  auth: operators,
  input: { dispute_id: input.int({ required: true }) },
  stack: [
    s.db.get_by_id({ table: disputes, id: inp("dispute_id"), as: "dispute" }),
    s.precondition({
      expr: expr(ref("dispute", { safe: true }), "!=", c.null()),
      error: c.text("Dispute not found."),
      error_type: "notfound",
    }),
    s.db.get_by_id({ table: transactions, id: ref("dispute.transaction_id"), as: "txn" }),
    s.db.query({
      table: decision_rules,
      where: expr(col("reason_code"), "=", ref("dispute.reason_code")),
      returnType: "single",
      as: "rule",
    }),
    s.precondition({
      expr: expr(ref("rule", { safe: true }), "!=", c.null()),
      error: c.text("No decision rule covers this dispute's reason code."),
      error_type: "badrequest",
    }),
    // The AI agent identity that every agent proposal is attributed to.
    s.db.query({
      table: operators,
      where: expr(col("kind"), "=", c.text("agent")),
      returnType: "single",
      as: "agent_op",
    }),
    s.precondition({
      expr: expr(ref("agent_op", { safe: true }), "!=", c.null()),
      error: c.text("No agent identity is seeded."),
      error_type: "standard",
    }),

    // Run the agent over the dispute + its policy.
    s.ai.agent.run({
      agent: disputeTriageAgent,
      args: {
        reason_code: ref("dispute.reason_code"),
        amount_cents: ref("dispute.amount_cents"),
        merchant: ref("txn.merchant"),
        allowed_resolution: ref("rule.allowed_resolution"),
        max_auto_resolve_cents: ref("rule.max_auto_resolve_cents"),
      },
      as: "run",
    }),

    // Derive the payout deterministically from the proposed resolution.
    s.set_var("proposed_amount", c.int(0)),
    s.conditional({
      when: expr(ref("run.result.proposed_resolution"), "!=", c.text("deny")),
      then: [s.set_var("proposed_amount", ref("dispute.amount_cents"))],
    }),

    // Flag a proposal whose payout is over the rule ceiling.
    s.set_var("agent_allowed", c.bool(true)),
    s.set_var("agent_block_reason", c.text("")),
    s.conditional({
      when: and(
        expr(ref("run.result.proposed_resolution"), "!=", c.text("deny")),
        expr(ref("dispute.amount_cents"), ">", ref("rule.max_auto_resolve_cents")),
      ),
      then: [
        s.set_var("agent_allowed", c.bool(false)),
        s.set_var(
          "agent_block_reason",
          c.text("Proposed payout is over the rule ceiling; a supervisor must apply it."),
        ),
      ],
    }),

    s.db.add({
      table: agent_runs,
      row: {
        dispute_id: inp("dispute_id"),
        prompt: c.text("Live agent triage via s.ai.agent.run over the dispute and its policy."),
        classification: ref("run.result.classification"),
        proposed_resolution: ref("run.result.proposed_resolution"),
        proposed_amount_cents: ref("proposed_amount"),
        allowed: ref("agent_allowed"),
        blocked_reason: ref("agent_block_reason"),
      },
      as: "ar",
    }),
    s.db.add({
      table: dispute_actions,
      row: {
        dispute_id: inp("dispute_id"),
        actor_id: ref("agent_op.id"),
        actor_kind: "agent",
        action: "propose",
        detail: ref("run.result.classification"),
        agent_run_id: ref("ar.id"),
      },
    }),

    // Move an open dispute to triaged once the agent has weighed in.
    s.conditional({
      when: expr(ref("dispute.status"), "=", c.text("open")),
      then: [
        s.db.edit({
          table: disputes,
          fieldName: "id",
          fieldValue: inp("dispute_id"),
          row: { status: "triaged" },
        }),
      ],
    }),
  ],
  response: {
    agent_run_id: ref("ar.id"),
    classification: ref("run.result.classification"),
    proposed_resolution: ref("run.result.proposed_resolution"),
    proposed_amount_cents: ref("proposed_amount"),
    allowed: ref("agent_allowed"),
    blocked_reason: ref("agent_block_reason"),
  },
});
