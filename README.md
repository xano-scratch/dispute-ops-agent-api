# Dispute Ops Agent API

**A governed banking dispute API where a human ops agent and an AI agent call the same
permissioned, audited endpoints, so one rule layer decides every chargeback the same way for people
and agents.**

`6 tables · 7 endpoints · 1 AI agent` · Play 4 (Agent Intelligence Layer) · Banking

![The Dispute Ops Agent API frontend: an AI agent is blocked by the same resolve ceiling that stops a non-supervisor person, with the human and agent audit trail interleaved.](docs/screenshot.png)

## What it demonstrates

A bank wants to let an AI agent triage card disputes. The Director of AI has one question before
that ships: can the agent do anything a policy would forbid a person? This backend answers it by
construction. A human ops agent and an AI agent authenticate against the same table and call the same
endpoints, and the resolve endpoint runs one rule guard for both. The agent cannot resolve a dispute
its role or the amount ceiling would block, because the identical check blocks a person the same way.

That is the Agent Intelligence Layer play (Play 4) for banking. The value is not that an agent is
fast. The value is that the business logic lives in one governed API layer a technical reviewer can
read, run, and trust, and it treats an agent and a person alike.

Permissions are API-layer role checks (an auth table, a minted token, and a per-endpoint
`s.precondition` guard), never row-level security. Every governed action, human or agent, writes one
row to an audit log, so the trail reads as one interleaved history.

## Repo layout

```
xano/
  index.ts               registers the workspace (tables, API group, agent, endpoints)
  tables/                operators (auth), transactions, disputes, decision_rules,
                         dispute_actions (audit log), agent_runs
  agents/                dispute_triage_agent, the xano-free AI agent (structured output)
  api/                   the API group and the 7 endpoints
frontend/
  src/lib/api.ts         the one contract: paths and types derived from the query defs
  src/App.tsx            identity switcher, dispute queue, dispute detail
docs/                    the landing page and the screenshot
```

## API surface

All paths sit under the pinned `dispute` API group. Every endpoint except `seed` and `login`
requires a bearer token.

| Verb | Path | What it enforces |
| --- | --- | --- |
| POST | `/api:dispute/seed` | Idempotent bootstrap. Seeds identities, policy, transactions, and disputes, then mints a token per identity. |
| POST | `/api:dispute/login` | Email and password to a token via `check_password`. Lets the demo switch between the roles and the agent. |
| POST | `/api:dispute/cases/open` | Opens a dispute after checking the transaction exists and the reason code has a rule. Writes an `open` action. |
| POST | `/api:dispute/triage` | The AI agent endpoint (`s.ai.agent.run`). Classifies the dispute and proposes a resolution inside the policy. Records an agent run and a `propose` action tagged agent. |
| POST | `/api:dispute/cases/resolve` | The rule guard. The same role check and amount-ceiling check run for a human and the agent. Writes `apply` or `block`. |
| GET | `/api:dispute/cases` | Lists disputes, with an optional status filter. |
| GET | `/api:dispute/cases/{dispute_id}` | One case with its transaction, the governing rule, the full audit trail, and its agent runs. |

## How the rule binds both callers

The resolve endpoint reads the caller's role from the operators table and the reason's rule from the
decision-rules table, then applies two checks:

1. The caller's role must meet the rule's required role.
2. The dispute amount must sit within the caller's resolve ceiling and the rule's ceiling, unless the
   caller is a supervisor.

The AI agent is an operator row like any other, with a role and a ceiling. So an over-ceiling
resolution is refused for the agent and for a non-supervisor person in the same code path, and each
refusal writes a `block` row. Only a supervisor can apply it. The proposed payout is derived in the
endpoint from the proposed resolution, never taken from the model, so a stray model output cannot
slip a payout past the ceiling.

## Quick start

Go from clone to a live, governed backend in about a minute.

```bash
git clone https://github.com/xano-scratch/dispute-ops-agent-api.git
cd dispute-ops-agent-api
npm install
npx xanots login          # authenticate with Xano (once)
npm run xano:deploy        # builds the frontend, deploys the backend, prints the live URL
```

The deploy prints a live ephemeral URL. Open it, keep the identity on the AI agent, and open the
over-ceiling duplicate case. Run agent triage to see the proposal flagged over the ceiling, then
Apply and watch the block. Switch to the supervisor and apply again to watch it pass.

Other scripts:

```bash
npm run typecheck          # tsc --noEmit
npm run build              # build the frontend
npm run xano:export        # compile the backend to workspace.json
```

## FAQ

**Is this row-level security?** No. Permissions are API-layer. An auth table backs identity, a login
mints a token, and each protected endpoint runs a role and ceiling check before it writes. There is
no row-level security anywhere in this project.

**How does the agent stay inside policy?** The triage endpoint hands the agent the reason's rule and
asks for a classification and a resolution. It derives the payout amount from that resolution in the
endpoint, and the resolve endpoint runs the same guard on the agent that it runs on a person. The
agent proposes; the guard decides.

**Does it need any credentials or external services?** No. The AI agent runs on the `xano-free`
provider, and the whole app runs on seed data. There are no API keys to set.

**Is this a production system?** No. It is a scratch proof artifact that shows one governed pattern.
The demo credentials are public fixtures for an ephemeral, not real accounts.
