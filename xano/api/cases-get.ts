import { query, input, s, ref, inp, expr, col, c } from "@xanots/core";
import { disputeApi } from "./dispute-group.js";
import { operators } from "../tables/operators.js";
import { transactions } from "../tables/transactions.js";
import { decisionRules } from "../tables/decision-rules.js";
import { disputes } from "../tables/disputes.js";
import { disputeActions } from "../tables/dispute-actions.js";
import { agentRuns } from "../tables/agent-runs.js";

/**
 * GET api:dispute/cases/{dispute_id} — one dispute with its transaction, the
 * matched decision rule, its full audit trail (human and agent interleaved,
 * oldest first), and its agent runs (newest first).
 */
export const casesGetQuery = query({
  name: "cases/{dispute_id}",
  verb: "GET",
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
    s.db.get_by_id({
      table: transactions,
      id: ref("dispute.transaction_id"),
      as: "transaction",
    }),
    s.db.query({
      table: decisionRules,
      where: expr(col("reason_code"), "=", ref("dispute.reason_code")),
      returnType: "single",
      as: "rule",
    }),
    s.db.query({
      table: disputeActions,
      where: expr(col("dispute_id"), "=", ref("dispute.id")),
      sort: [{ sortBy: "created_at", dir: "asc" }],
      as: "actions",
    }),
    s.db.query({
      table: agentRuns,
      where: expr(col("dispute_id"), "=", ref("dispute.id")),
      sort: [{ sortBy: "created_at", dir: "desc" }],
      as: "agent_runs",
    }),
  ],
  response: {
    dispute: ref("dispute"),
    transaction: ref("transaction"),
    rule: ref("rule"),
    actions: ref("actions"),
    agent_runs: ref("agent_runs"),
  },
});

export type CasesGetResponse = import("@xanots/core").InferResponse<
  typeof casesGetQuery
>;
