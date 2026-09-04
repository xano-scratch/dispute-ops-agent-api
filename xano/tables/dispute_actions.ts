import { table, f } from "@xanots/sdk";
import { disputes } from "./disputes.js";
import { operators } from "./operators.js";
import { agent_runs } from "./agent_runs.js";

/**
 * The audit log: one row per governed action, human or agent, interleaved. Every
 * open, propose, apply, and block writes a row here, tagged with the actor and
 * whether it was a person or the AI agent. `agent_run_id` links a `propose` row
 * to the agent run that produced it (0 = none, the optional-FK sentinel).
 */
export const dispute_actions = table({
  name: "dispute_actions",
  schema: {
    dispute_id: f.tableRef(disputes, { required: true }),
    actor_id: f.tableRef(operators, { required: true }),
    actor_kind: f.enum(["human", "agent"], { required: true }),
    action: f.enum(["open", "triage", "propose", "apply", "block"], { required: true }),
    detail: f.text(),
    agent_run_id: f.tableRef(agent_runs, { required: true, default: 0 }),
  },
});
