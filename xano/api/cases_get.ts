import { query, input, s, c, ref, inp, expr, col } from "@xanots/sdk";
import { disputeApi } from "./dispute.js";
import { operators } from "../tables/operators.js";
import { transactions } from "../tables/transactions.js";
import { decision_rules } from "../tables/decision_rules.js";
import { disputes } from "../tables/disputes.js";
import { agent_runs } from "../tables/agent_runs.js";
import { dispute_actions } from "../tables/dispute_actions.js";

/**
 * Fetch one dispute with everything a reviewer needs to audit it: its transaction,
 * the decision rule that governs its reason code, its full `dispute_actions` trail
 * (human and agent interleaved, oldest first), and its `agent_runs`.
 */
export const casesGetQuery = query({
  name: "cases/{dispute_id}",
  verb: "GET",
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
    s.db.query({
      table: dispute_actions,
      where: expr(col("dispute_id"), "=", inp("dispute_id")),
      sort: [{ sortBy: "id", dir: "asc" }],
      as: "actions",
    }),
    s.db.query({
      table: agent_runs,
      where: expr(col("dispute_id"), "=", inp("dispute_id")),
      sort: [{ sortBy: "id", dir: "asc" }],
      as: "runs",
    }),
  ],
  response: {
    dispute: ref("dispute"),
    transaction: ref("txn"),
    rule: ref("rule"),
    actions: ref("actions"),
    agent_runs: ref("runs"),
  },
});
