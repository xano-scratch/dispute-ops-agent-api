import { table, f } from "@xanots/sdk";
import { transactions } from "./transactions.js";
import { operators } from "./operators.js";

/**
 * A chargeback case against a transaction. `amount_cents` is the exposure the
 * resolve ceiling is checked against. `resolution`/`resolved_by` stay unset
 * until a governed apply lands.
 *
 * An optional foreign key stores a `0` sentinel (never `nullable`): a null in an
 * `f.tableRef` is unqueryable, so `resolved_by` defaults to `0` (= not resolved
 * yet) and is read with the field-match `db.get`, never `db.get_by_id`.
 */
export const disputes = table({
  name: "disputes",
  schema: {
    transaction_id: f.tableRef(transactions, { required: true }),
    reason_code: f.enum(["fraud", "duplicate", "not_received", "incorrect_amount"], {
      required: true,
    }),
    amount_cents: f.int({ required: true }),
    status: f.enum(["open", "triaged", "resolved", "rejected", "escalated"], {
      required: true,
      default: "open",
    }),
    opened_by: f.tableRef(operators, { required: true }),
    resolution: f.enum(["refund", "deny", "partial"], { nullable: true }),
    resolved_by: f.tableRef(operators, { required: true, default: 0 }),
  },
});
