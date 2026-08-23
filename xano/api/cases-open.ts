import { query, input, s, ref, inp, auth, expr, col, c, obj } from "@xanots/core";
import { disputeApi } from "./dispute-group.js";
import { operators } from "../tables/operators.js";
import { transactions } from "../tables/transactions.js";
import { decisionRules } from "../tables/decision-rules.js";
import { disputes } from "../tables/disputes.js";
import { disputeActions } from "../tables/dispute-actions.js";

/**
 * POST api:dispute/cases/open — open a dispute against a transaction. Validates
 * that the transaction exists and that the reason code is one the policy
 * covers, sets status=open, and writes an "open" audit action tagged with the
 * caller's kind (human or agent).
 */
export const casesOpenQuery = query({
  name: "cases/open",
  verb: "POST",
  apiGroup: disputeApi,
  auth: operators,
  input: {
    transaction_id: input.int({ required: true }),
    reason_code: input.enum(
      ["fraud", "duplicate", "not_received", "incorrect_amount"],
      { required: true },
    ),
    amount_cents: input.int({ required: true }),
  },
  stack: [
    s.db.get_by_id({ table: operators, id: auth("id"), as: "caller" }),
    s.precondition({
      expr: expr(ref("caller"), "!=", c.null()),
      error: c.text("You must sign in as an operator."),
      error_type: "unauthorized",
    }),
    s.db.get_by_id({
      table: transactions,
      id: inp("transaction_id"),
      as: "txn",
    }),
    s.precondition({
      expr: expr(ref("txn"), "!=", c.null()),
      error: c.text("That transaction does not exist."),
      error_type: "notfound",
    }),
    s.db.query({
      table: decisionRules,
      where: expr(col("reason_code"), "=", inp("reason_code")),
      returnType: "single",
      as: "rule",
    }),
    s.precondition({
      expr: expr(ref("rule"), "!=", c.null()),
      error: c.text("No decision rule covers that reason code."),
      error_type: "badrequest",
    }),
    s.db.add({
      table: disputes,
      row: {
        transaction_id: inp("transaction_id"),
        reason_code: inp("reason_code"),
        amount_cents: inp("amount_cents"),
        status: "open",
        opened_by: auth("id"),
      },
      as: "dispute",
    }),
    s.db.add({
      table: disputeActions,
      row: {
        dispute_id: ref("dispute.id"),
        actor_id: auth("id"),
        actor_kind: ref("caller.kind"),
        action: "open",
        detail: "Dispute opened.",
      },
    }),
  ],
  response: {
    dispute: ref("dispute"),
    rule: obj({
      reason_code: ref("rule.reason_code"),
      allowed_resolution: ref("rule.allowed_resolution"),
      max_auto_resolve_cents: ref("rule.max_auto_resolve_cents"),
      requires_role: ref("rule.requires_role"),
    }),
  },
});

export type CasesOpenBody = import("@xanots/core").InferInput<
  typeof casesOpenQuery
>;
export type CasesOpenResponse = import("@xanots/core").InferResponse<
  typeof casesOpenQuery
>;
