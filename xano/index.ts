import { workspace } from "@xanots/sdk";

import { transactions } from "./tables/transactions.js";
import { operators } from "./tables/operators.js";
import { disputes } from "./tables/disputes.js";
import { decision_rules } from "./tables/decision_rules.js";
import { agent_runs } from "./tables/agent_runs.js";
import { dispute_actions } from "./tables/dispute_actions.js";

import { disputeApi } from "./api/dispute.js";
import { disputeTriageAgent } from "./agents/dispute_triage_agent.js";

import { seedQuery } from "./api/seed.js";
import { loginQuery } from "./api/login.js";
import { openQuery } from "./api/open.js";
import { triageQuery } from "./api/triage.js";
import { resolveQuery } from "./api/resolve.js";
import { casesListQuery } from "./api/cases_list.js";
import { casesGetQuery } from "./api/cases_get.js";

/**
 * Dispute Ops Agent API — a governed banking dispute backend where a human ops
 * agent and an AI agent call the SAME permissioned, audited endpoints, so one
 * rule layer decides every chargeback the same way for people and agents.
 */
export default workspace("dispute-ops-agent-api")
  .registerTables([
    transactions,
    operators,
    disputes,
    decision_rules,
    agent_runs,
    dispute_actions,
  ])
  .registerApiGroups([disputeApi])
  .registerAgents([disputeTriageAgent])
  .registerQueries([
    seedQuery,
    loginQuery,
    openQuery,
    triageQuery,
    resolveQuery,
    casesListQuery,
    casesGetQuery,
  ]);
