import { query, input, s, ref, inp, cmp, col } from "@xanots/sdk";
import { disputeApi } from "./dispute.js";
import { operators } from "../tables/operators.js";
import { disputes } from "../tables/disputes.js";

/**
 * List disputes, oldest first, optionally filtered by status. `status` is taken
 * as free text so an absent value simply drops the filter (`ignoreEmpty`) and a
 * bad one returns no rows, rather than a 400 at the boundary.
 */
export const casesListQuery = query({
  name: "cases",
  verb: "GET",
  apiGroup: disputeApi,
  auth: operators,
  input: { status: input.text({ required: false }) },
  stack: [
    s.db.query({
      table: disputes,
      where: cmp(col("status"), "=", inp("status"), { ignoreEmpty: true }),
      sort: [{ sortBy: "id", dir: "asc" }],
      as: "rows",
    }),
  ],
  response: ref("rows"),
});
