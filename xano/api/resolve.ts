import { query, input, s, c, ref, inp, auth, expr, and, or, col, withFilters, fl } from "@xanots/sdk";
import { disputeApi } from "./dispute.js";
import { operators } from "../tables/operators.js";
import { decision_rules } from "../tables/decision_rules.js";
import { disputes } from "../tables/disputes.js";
import { dispute_actions } from "../tables/dispute_actions.js";

/**
 * The rule-guarded apply — the endpoint that proves ONE rule binds both callers.
 * Callable by a human OR the agent identity, with the SAME guards:
 *   (a) the caller's role must meet the rule's `requires_role`, and
 *   (b) the dispute amount must be within BOTH the caller's `resolve_limit_cents`
 *       and the rule's `max_auto_resolve_cents` — unless the caller is a supervisor.
 *
 * A refused resolution writes a `block` action and returns `blocked: true`; it is
 * refused identically for the agent identity and for a non-supervisor human. Only
 * a supervisor may apply an over-ceiling resolution, which writes an `apply` action
 * and sets the dispute to `resolved`.
 */
export const resolveQuery = query({
  name: "cases/resolve",
  verb: "POST",
  apiGroup: disputeApi,
  auth: operators,
  input: {
    dispute_id: input.int({ required: true }),
    resolution: input.enum(["refund", "deny", "partial"], { required: true }),
  },
  stack: [
    s.db.get_by_id({ table: operators, id: auth("id"), as: "me" }),
    s.precondition({
      expr: expr(ref("me", { safe: true }), "!=", c.null()),
      error: c.text("Unknown operator."),
      error_type: "unauthorized",
    }),
    s.db.get_by_id({ table: disputes, id: inp("dispute_id"), as: "dispute" }),
    s.precondition({
      expr: expr(ref("dispute", { safe: true }), "!=", c.null()),
      error: c.text("Dispute not found."),
      error_type: "notfound",
    }),
    s.precondition({
      expr: or(
        expr(ref("dispute.status"), "=", c.text("open")),
        expr(ref("dispute.status"), "=", c.text("triaged")),
      ),
      error: c.text("This dispute is not open for resolution."),
      error_type: "badrequest",
    }),
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

    // Rank the caller's role and the rule's required role (triage < resolver < supervisor).
    s.set_var("my_rank", c.int(0)),
    s.switch({
      on: ref("me.role"),
      cases: [
        { when: c.text("triage"), body: [s.set_var("my_rank", c.int(1))], break: true },
        { when: c.text("resolver"), body: [s.set_var("my_rank", c.int(2))], break: true },
        { when: c.text("supervisor"), body: [s.set_var("my_rank", c.int(3))], break: true },
      ],
    }),
    s.set_var("required_rank", c.int(0)),
    s.switch({
      on: ref("rule.requires_role"),
      cases: [
        { when: c.text("triage"), body: [s.set_var("required_rank", c.int(1))], break: true },
        { when: c.text("resolver"), body: [s.set_var("required_rank", c.int(2))], break: true },
        { when: c.text("supervisor"), body: [s.set_var("required_rank", c.int(3))], break: true },
      ],
    }),

    s.set_var("applied", c.bool(false)),
    s.set_var("blocked", c.bool(false)),
    s.set_var("reason", c.text("")),
    s.conditional({
      // role meets the requirement AND (amount within both ceilings OR caller is a supervisor).
      when: and(
        expr(ref("my_rank"), ">=", ref("required_rank")),
        or(
          and(
            expr(ref("dispute.amount_cents"), "<=", ref("me.resolve_limit_cents")),
            expr(ref("dispute.amount_cents"), "<=", ref("rule.max_auto_resolve_cents")),
          ),
          expr(ref("me.role"), "=", c.text("supervisor")),
        ),
      ),
      then: [
        s.db.edit({
          table: disputes,
          fieldName: "id",
          fieldValue: inp("dispute_id"),
          row: {
            status: "resolved",
            resolution: inp("resolution"),
            resolved_by: ref("me.id"),
          },
        }),
        s.db.add({
          table: dispute_actions,
          row: {
            dispute_id: inp("dispute_id"),
            actor_id: ref("me.id"),
            actor_kind: ref("me.kind"),
            action: "apply",
            detail: withFilters(c.text("Applied resolution: "), fl.concat(inp("resolution"))),
          },
        }),
        s.set_var("applied", c.bool(true)),
        s.set_var("reason", c.text("Resolution applied.")),
      ],
      else: [
        // Default to the role reason; if the role was fine, the ceiling is what blocked it.
        s.set_var("reason", c.text("Your role is not permitted to resolve this reason code.")),
        s.conditional({
          when: expr(ref("my_rank"), ">=", ref("required_rank")),
          then: [
            s.set_var(
              "reason",
              c.text("The dispute amount is over the resolve ceiling; only a supervisor can apply it."),
            ),
          ],
        }),
        s.db.add({
          table: dispute_actions,
          row: {
            dispute_id: inp("dispute_id"),
            actor_id: ref("me.id"),
            actor_kind: ref("me.kind"),
            action: "block",
            detail: ref("reason"),
          },
        }),
        s.set_var("blocked", c.bool(true)),
      ],
    }),
    s.db.get_by_id({ table: disputes, id: inp("dispute_id"), as: "final" }),
  ],
  response: {
    applied: ref("applied"),
    blocked: ref("blocked"),
    reason: ref("reason"),
    dispute: ref("final"),
  },
});
