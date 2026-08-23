import {
  query,
  input,
  s,
  ref,
  inp,
  auth,
  expr,
  col,
  c,
  withFilters,
  fl,
} from "@xanots/core";
import { disputeApi } from "./dispute-group.js";
import { disputeTriageAgent } from "../agents/dispute-triage-agent.js";
import { operators } from "../tables/operators.js";
import { transactions } from "../tables/transactions.js";
import { decisionRules } from "../tables/decision-rules.js";
import { disputes } from "../tables/disputes.js";
import { disputeActions } from "../tables/dispute-actions.js";
import { agentRuns } from "../tables/agent-runs.js";

/**
 * POST api:dispute/triage — the AI agent endpoint. It reads one dispute, hands
 * the case and its governing rule to `s.ai.agent.run`, and records what the
 * agent proposed. The agent proposes only. It never writes the final
 * resolution, and if its proposed amount is over the rule ceiling the proposal
 * is still recorded with allowed=false. The proposal is attributed to the AI
 * agent identity (actor_kind=agent) in the shared audit trail.
 *
 * This def imports an agent, so its stack builds a heavy graph. The frontend
 * reads its path/verb from the ROUTES table in src/lib/api.ts and its types
 * from the aliases exported below, so the agent graph never enters the browser
 * bundle (the split-route-metadata rule).
 */
export const triageQuery = query({
  name: "triage",
  verb: "POST",
  apiGroup: disputeApi,
  auth: operators,
  input: {
    dispute_id: input.int({ required: true }),
  },
  stack: [
    s.db.get_by_id({ table: disputes, id: inp("dispute_id"), as: "dispute" }),
    s.precondition({
      expr: expr(ref("dispute"), "!=", c.null()),
      error: c.text("That dispute does not exist."),
      error_type: "notfound",
    }),
    // dispute is non-null past the guard, so these reads are safe.
    s.db.get_by_id({
      table: transactions,
      id: ref("dispute.transaction_id"),
      as: "txn",
    }),
    s.db.query({
      table: decisionRules,
      where: expr(col("reason_code"), "=", ref("dispute.reason_code")),
      returnType: "single",
      as: "rule",
    }),
    s.precondition({
      expr: expr(ref("rule"), "!=", c.null()),
      error: c.text("No decision rule covers this dispute's reason code."),
      error_type: "badrequest",
    }),
    // The AI agent identity the proposal is attributed to.
    s.db.query({
      table: operators,
      where: expr(col("kind"), "=", c.text("agent")),
      returnType: "single",
      as: "agent_op",
    }),
    s.precondition({
      expr: expr(ref("agent_op"), "!=", c.null()),
      error: c.text("No agent identity is configured. Seed the workspace first."),
      error_type: "badrequest",
    }),

    // Run the agent with the case and its policy as run inputs.
    s.ai.agent.run({
      agent: disputeTriageAgent,
      args: {
        reason_code: ref("dispute.reason_code"),
        merchant: ref("txn.merchant"),
        amount_cents: ref("dispute.amount_cents"),
        allowed_resolution: ref("rule.allowed_resolution"),
        max_auto_resolve_cents: ref("rule.max_auto_resolve_cents"),
      },
      as: "run",
    }),

    // Derive the amount from the proposed resolution so it is deterministic and
    // cannot dodge the ceiling: a refund (or partial) is capped at the disputed
    // charge; a denial moves nothing.
    s.switch({
      on: ref("run.result.proposed_resolution"),
      cases: [
        {
          when: c.text("deny"),
          body: [s.set_var("proposed_amount", c.int(0))],
          break: true,
        },
      ],
      default: [s.set_var("proposed_amount", ref("dispute.amount_cents"))],
    }),

    // Policy check on the proposal: within the ceiling → allowed; over it →
    // recorded but flagged for a supervisor.
    s.conditional({
      when: expr(
        ref("proposed_amount"),
        "<=",
        ref("rule.max_auto_resolve_cents"),
      ),
      then: [
        s.set_var("allowed", c.bool(true)),
        s.set_var("blocked_reason", c.null()),
      ],
      else: [
        s.set_var("allowed", c.bool(false)),
        s.set_var(
          "blocked_reason",
          c.text(
            "The proposed amount is over the auto-resolve ceiling for this reason code, so a supervisor must apply it.",
          ),
        ),
      ],
    }),

    // A readable record of what the agent was asked.
    s.set_var(
      "prompt_summary",
      withFilters(
        c.text("Triage a "),
        fl.concat(ref("dispute.reason_code")),
        fl.concat(c.text(" dispute on ")),
        fl.concat(ref("txn.merchant")),
        fl.concat(c.text(".")),
      ),
    ),

    s.db.add({
      table: agentRuns,
      row: {
        dispute_id: ref("dispute.id"),
        prompt: ref("prompt_summary"),
        classification: ref("run.result.classification"),
        proposed_resolution: ref("run.result.proposed_resolution"),
        proposed_amount_cents: ref("proposed_amount"),
        allowed: ref("allowed"),
        blocked_reason: ref("blocked_reason"),
      },
      as: "agent_run",
    }),

    // The proposal is an agent action in the shared trail.
    s.db.add({
      table: disputeActions,
      row: {
        dispute_id: ref("dispute.id"),
        actor_id: ref("agent_op.id"),
        actor_kind: "agent",
        action: "propose",
        detail: ref("run.result.classification"),
        agent_run_id: ref("agent_run.id"),
      },
    }),

    // Reflect that the case has been triaged.
    s.db.edit({
      table: disputes,
      fieldName: "id",
      fieldValue: ref("dispute.id"),
      row: { status: "triaged" },
    }),
  ],
  response: {
    agent_run: ref("agent_run"),
    allowed: ref("allowed"),
    blocked_reason: ref("blocked_reason"),
    classification: ref("run.result.classification"),
    proposed_resolution: ref("run.result.proposed_resolution"),
    proposed_amount_cents: ref("proposed_amount"),
  },
});

export type TriageBody = import("@xanots/core").InferInput<typeof triageQuery>;
export type TriageResponse = import("@xanots/core").InferResponse<
  typeof triageQuery
>;
