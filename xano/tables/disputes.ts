import { table, f } from "@xanots/core";
import { transactions } from "./transactions.js";
import { operators } from "./operators.js";

/** Disputes — a chargeback case against one transaction. */
export const disputes = table({
  name: "disputes",
  schema: {
    transaction_id: f.tableRef(transactions, { required: true }),
    reason_code: f.enum(
      ["fraud", "duplicate", "not_received", "incorrect_amount"],
      { required: true },
    ),
    amount_cents: f.int({ required: true }),
    status: f.enum(
      ["open", "triaged", "resolved", "rejected", "escalated"],
      { required: true },
    ),
    opened_by: f.tableRef(operators, { required: true }),
    // Set only when the case is resolved.
    resolution: f.enum(["refund", "deny", "partial"], { nullable: true }),
    resolved_by: f.tableRef(operators, { nullable: true }),
  },
});
