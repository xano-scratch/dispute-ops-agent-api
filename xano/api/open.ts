import { query, input, s, c, ref, inp, auth, expr, col } from "@xanots/sdk";
import { disputeApi } from "./dispute.js";
import { operators } from "../tables/operators.js";
import { transactions } from "../tables/transactions.js";
import { decision_rules } from "../tables/decision_rules.js";
import { disputes } from "../tables/disputes.js";
import { dispute_actions } from "../tables/dispute_actions.js";

/**
 * Open a dispute against a transaction. Any authenticated operator may open one.
 * Guards that the transaction exists and that the reason code is one the policy
 * covers, sets the dispute to `open`, and writes an `open` audit action tagged
 * with the caller's kind. The disputed amount is the transaction amount.
 */
export const openQuery = query({
  name: "cases/open",
  verb: "POST",
  apiGroup: disputeApi,
  auth: operators,
  input: {
    transaction_id: input.int({ required: true }),
    reason_code: input.enum(["fraud", "duplicate", "not_received", "incorrect_amount"], {
      required: true,
    }),
  },
  stack: [
    s.db.get_by_id({ table: operators, id: auth("id"), as: "me" }),
    s.precondition({
      expr: expr(ref("me", { safe: true }), "!=", c.null()),
      error: c.text("Unknown operator."),
      error_type: "unauthorized",
    }),
    s.db.get_by_id({ table: transactions, id: inp("transaction_id"), as: "txn" }),
    s.precondition({
      expr: expr(ref("txn", { safe: true }), "!=", c.null()),
      error: c.text("No such transaction."),
      error_type: "notfound",
    }),
    s.db.query({
      table: decision_rules,
      where: expr(col("reason_code"), "=", inp("reason_code")),
      returnType: "single",
      as: "rule",
    }),
    s.precondition({
      expr: expr(ref("rule", { safe: true }), "!=", c.null()),
      error: c.text("No decision rule covers that reason code."),
      error_type: "badrequest",
    }),
    s.db.add({
      table: disputes,
      row: {
        transaction_id: inp("transaction_id"),
        reason_code: inp("reason_code"),
        amount_cents: ref("txn.amount_cents"),
        status: "open",
        opened_by: ref("me.id"),
      },
      as: "dispute",
    }),
    s.db.add({
      table: dispute_actions,
      row: {
        dispute_id: ref("dispute.id"),
        actor_id: ref("me.id"),
        actor_kind: ref("me.kind"),
        action: "open",
        detail: c.text("Opened dispute."),
      },
    }),
  ],
  response: { dispute: ref("dispute") },
});
