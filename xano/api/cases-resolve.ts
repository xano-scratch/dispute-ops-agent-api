import {
  query,
  input,
  s,
  ref,
  inp,
  auth,
  expr,
  and,
  or,
  col,
  c,
} from "@xanots/core";
import { disputeApi } from "./dispute-group.js";
import { operators } from "../tables/operators.js";
import { decisionRules } from "../tables/decision-rules.js";
import { disputes } from "../tables/disputes.js";
import { disputeActions } from "../tables/dispute-actions.js";

/**
 * POST api:dispute/cases/resolve — the rule-guarded apply, callable by a human
 * OR the agent identity through the SAME guard. The rule layer checks that the
 * caller's role meets the rule's requires_role and that the amount is within
 * both the caller's resolve_limit_cents and the rule's max_auto_resolve_cents;
 * a supervisor overrides the amount ceiling. An over-limit resolution is
 * refused for the agent and for a non-supervisor human alike, and every refusal
 * writes a "block" action. This is the endpoint that proves one API-layer rule
 * binds both callers.
 *
 * The refusal is returned as HTTP 200 with outcome=blocked (not a bare 403) so
 * the block is audited and the UI can show the same refusal for both callers.
 */
export const casesResolveQuery = query({
  name: "cases/resolve",
  verb: "POST",
  apiGroup: disputeApi,
  auth: operators,
  input: {
    dispute_id: input.int({ required: true }),
    resolution: input.enum(["refund", "deny", "partial"], { required: true }),
    amount_cents: input.int({ required: true }),
  },
  stack: [
    s.db.get_by_id({ table: operators, id: auth("id"), as: "caller" }),
    s.precondition({
      expr: expr(ref("caller"), "!=", c.null()),
      error: c.text("You must sign in as an operator."),
      error_type: "unauthorized",
    }),
    s.db.get_by_id({ table: disputes, id: inp("dispute_id"), as: "dispute" }),
    s.precondition({
      expr: expr(ref("dispute"), "!=", c.null()),
      error: c.text("That dispute does not exist."),
      error_type: "notfound",
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

    // Rank the caller's role and the rule's minimum role so they compare.
    s.switch({
      on: ref("caller.role"),
      cases: [
        { when: c.text("triage"), body: [s.set_var("caller_rank", c.int(1))], break: true },
        { when: c.text("resolver"), body: [s.set_var("caller_rank", c.int(2))], break: true },
        { when: c.text("supervisor"), body: [s.set_var("caller_rank", c.int(3))], break: true },
      ],
      default: [s.set_var("caller_rank", c.int(0))],
    }),
    s.switch({
      on: ref("rule.requires_role"),
      cases: [
        { when: c.text("triage"), body: [s.set_var("required_rank", c.int(1))], break: true },
        { when: c.text("resolver"), body: [s.set_var("required_rank", c.int(2))], break: true },
        { when: c.text("supervisor"), body: [s.set_var("required_rank", c.int(3))], break: true },
      ],
      default: [s.set_var("required_rank", c.int(99))],
    }),

    // Defaults so both vars are always bound (and typed) after the branch.
    s.set_var("outcome", c.text("blocked")),
    s.set_var("message", c.text("")),

    s.conditional({
      // Pass when the role meets the floor AND the amount is within both limits,
      // OR the caller is a supervisor (the amount-ceiling override).
      when: and(
        expr(ref("caller_rank"), ">=", ref("required_rank")),
        or(
          and(
            expr(inp("amount_cents"), "<=", ref("rule.max_auto_resolve_cents")),
            expr(inp("amount_cents"), "<=", ref("caller.resolve_limit_cents")),
          ),
          expr(ref("caller.role"), "=", c.text("supervisor")),
        ),
      ),
      then: [
        s.db.edit({
          table: disputes,
          fieldName: "id",
          fieldValue: ref("dispute.id"),
          row: {
            status: "resolved",
            resolution: inp("resolution"),
            resolved_by: ref("caller.id"),
          },
        }),
        s.db.add({
          table: disputeActions,
          row: {
            dispute_id: ref("dispute.id"),
            actor_id: ref("caller.id"),
            actor_kind: ref("caller.kind"),
            action: "apply",
            detail: "Resolution applied.",
          },
        }),
        s.update_var("outcome", c.text("applied")),
        s.update_var("message", c.text("Resolution applied.")),
      ],
      else: [
        // A specific reason: role floor vs amount ceiling.
        s.conditional({
          when: expr(ref("caller_rank"), "<", ref("required_rank")),
          then: [
            s.update_var(
              "message",
              c.text("Your role cannot apply resolutions for this reason code."),
            ),
          ],
          else: [
            s.update_var(
              "message",
              c.text(
                "This amount is over the allowed ceiling and your limit. A supervisor must apply it.",
              ),
            ),
          ],
        }),
        s.db.add({
          table: disputeActions,
          row: {
            dispute_id: ref("dispute.id"),
            actor_id: ref("caller.id"),
            actor_kind: ref("caller.kind"),
            action: "block",
            detail: ref("message"),
          },
        }),
        s.update_var("outcome", c.text("blocked")),
      ],
    }),
  ],
  response: {
    outcome: ref("outcome"),
    message: ref("message"),
    dispute_id: ref("dispute.id"),
    caller_limit_cents: ref("caller.resolve_limit_cents"),
    rule_ceiling_cents: ref("rule.max_auto_resolve_cents"),
  },
});

export type CasesResolveBody = import("@xanots/core").InferInput<
  typeof casesResolveQuery
>;
export type CasesResolveResponse = import("@xanots/core").InferResponse<
  typeof casesResolveQuery
>;
