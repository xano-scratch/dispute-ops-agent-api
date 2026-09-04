import { table, f } from "@xanots/sdk";
import { disputes } from "./disputes.js";

/**
 * What the AI triage endpoint decided for one dispute, and whether the policy
 * let it stand. `proposed_amount_cents` is derived deterministically in the
 * endpoint (never taken from the model), so a stray model output cannot dodge
 * the ceiling check. `allowed` is false when the proposed payout is over the
 * rule ceiling; `blocked_reason` says why.
 */
export const agent_runs = table({
  name: "agent_runs",
  schema: {
    dispute_id: f.tableRef(disputes, { required: true }),
    prompt: f.text(),
    classification: f.text(),
    proposed_resolution: f.enum(["refund", "deny", "partial"], { nullable: true }),
    proposed_amount_cents: f.int({ required: true, default: 0 }),
    allowed: f.bool({ required: true, default: true }),
    blocked_reason: f.text({ nullable: true }),
  },
});
