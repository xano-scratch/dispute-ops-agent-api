import { table, f } from "@xanots/core";
import { disputes } from "./disputes.js";
import { operators } from "./operators.js";
import { agentRuns } from "./agent-runs.js";

/**
 * Dispute actions — the audit log. One row per governed action, human or
 * agent, interleaved. `actor_kind` tags who did it; `agent_run_id` links a
 * propose action back to the run that produced it.
 */
export const disputeActions = table({
  name: "dispute_actions",
  schema: {
    dispute_id: f.tableRef(disputes, { required: true }),
    actor_id: f.tableRef(operators, { required: true }),
    actor_kind: f.enum(["human", "agent"], { required: true }),
    action: f.enum(["open", "triage", "propose", "apply", "block"], {
      required: true,
    }),
    detail: f.text({ required: true }),
    agent_run_id: f.tableRef(agentRuns, { nullable: true }),
  },
});
