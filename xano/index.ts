import { workspace } from "@xanots/core";

import { operators } from "./tables/operators.js";
import { transactions } from "./tables/transactions.js";
import { disputes } from "./tables/disputes.js";
import { decisionRules } from "./tables/decision-rules.js";
import { agentRuns } from "./tables/agent-runs.js";
import { disputeActions } from "./tables/dispute-actions.js";

import { disputeApi } from "./api/dispute-group.js";
import { disputeTriageAgent } from "./agents/dispute-triage-agent.js";

import { seedQuery } from "./api/seed.js";
import { loginQuery } from "./api/login.js";
import { casesOpenQuery } from "./api/cases-open.js";
import { triageQuery } from "./api/triage.js";
import { casesResolveQuery } from "./api/cases-resolve.js";
import { casesGetQuery } from "./api/cases-get.js";
import { casesListQuery } from "./api/cases-list.js";

/**
 * The dispute-ops-agent-api backend.
 *
 * A governed access layer over a bank's transaction-dispute domain. A human ops
 * agent and an AI agent call the SAME permissioned, audited endpoints, so one
 * rule layer decides every chargeback the same way for people and agents.
 */
export default workspace("dispute-ops-agent-api")
  .registerTables([
    operators,
    transactions,
    disputes,
    decisionRules,
    agentRuns,
    disputeActions,
  ])
  .registerApiGroups([disputeApi])
  .registerAgents([disputeTriageAgent])
  .registerQueries([
    seedQuery,
    loginQuery,
    casesOpenQuery,
    triageQuery,
    casesResolveQuery,
    casesGetQuery,
    casesListQuery,
  ]);
