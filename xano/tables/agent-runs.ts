import { table, f } from "@xanots/core";
import { disputes } from "./disputes.js";

/**
 * Agent runs — what the AI triage endpoint decided and whether policy let the
 * proposal stand. The agent proposes only; a run never writes the final
 * resolution.
 */
export const agentRuns = table({
  name: "agent_runs",
  schema: {
    dispute_id: f.tableRef(disputes, { required: true }),
    prompt: f.text({ required: true }),
    classification: f.text({ required: true }),
    proposed_resolution: f.enum(["refund", "deny", "partial"], {
      nullable: true,
    }),
    proposed_amount_cents: f.int({ required: true }),
    // False when the proposal is over the rule ceiling (still recorded).
    allowed: f.bool({ required: true }),
    blocked_reason: f.text({ nullable: true }),
  },
});
