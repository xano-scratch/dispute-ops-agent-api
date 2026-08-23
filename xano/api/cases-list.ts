import { query, input, s, ref, inp, cmp, col } from "@xanots/core";
import { disputeApi } from "./dispute-group.js";
import { operators } from "../tables/operators.js";
import { disputes } from "../tables/disputes.js";

/**
 * GET api:dispute/cases — list disputes, newest first, optionally filtered by
 * status. An omitted status drops the filter (ignoreEmpty), so the queue shows
 * every case.
 */
export const casesListQuery = query({
  name: "cases",
  verb: "GET",
  apiGroup: disputeApi,
  auth: operators,
  input: {
    status: input.enum(
      ["open", "triaged", "resolved", "rejected", "escalated"],
      { required: false },
    ),
  },
  stack: [
    s.db.query({
      table: disputes,
      where: cmp(col("status"), "=", inp("status"), { ignoreEmpty: true }),
      sort: [{ sortBy: "created_at", dir: "desc" }],
      as: "rows",
    }),
  ],
  response: {
    disputes: ref("rows"),
  },
});

export type CasesListBody = import("@xanots/core").InferInput<
  typeof casesListQuery
>;
export type CasesListResponse = import("@xanots/core").InferResponse<
  typeof casesListQuery
>;
