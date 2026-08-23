import {
  query,
  input,
  s,
  ref,
  inp,
  expr,
  and,
  or,
  col,
  c,
  obj,
} from "@xanots/core";
import { disputeApi } from "./dispute-group.js";
import { operators } from "../tables/operators.js";
import { transactions } from "../tables/transactions.js";
import { decisionRules } from "../tables/decision-rules.js";
import { disputes } from "../tables/disputes.js";
import { disputeActions } from "../tables/dispute-actions.js";
import { agentRuns } from "../tables/agent-runs.js";

/**
 * POST api:dispute/seed — make a fresh ephemeral browsable and hand the
 * frontend a token for each identity. It is idempotent: it populates only when
 * the workspace is empty (or when called with reset=true), so a reviewer's
 * actions survive a page refresh. It always returns the three operators (a
 * human triage, a human supervisor, and the AI agent identity) with a fresh
 * browse token, plus the transactions. Public so the demo can bootstrap.
 */
export const seedQuery = query({
  name: "seed",
  verb: "POST",
  apiGroup: disputeApi,
  auth: false,
  input: {
    reset: input.bool({ required: false }),
  },
  stack: [
    s.db.query({ table: operators, returnType: "count", as: "op_count" }),
    s.conditional({
      // Populate when empty, or when the caller asks for a reset.
      when: or(
        expr(ref("op_count"), "=", c.int(0)),
        expr(inp("reset"), "=", c.bool(true)),
      ),
      then: [
        s.db.truncate({ table: disputeActions, reset: true }),
        s.db.truncate({ table: agentRuns, reset: true }),
        s.db.truncate({ table: disputes, reset: true }),
        s.db.truncate({ table: decisionRules, reset: true }),
        s.db.truncate({ table: transactions, reset: true }),
        s.db.truncate({ table: operators, reset: true }),

        // Operators. All three share one demo password. The password column
        // hashes on write, so the plaintext is never stored or returned.
        s.db.add({
          table: operators,
          row: {
            email: "alex.triage@bank.example",
            password: "disputes-demo",
            name: "Alex Rivera",
            kind: "human",
            role: "triage",
            resolve_limit_cents: 0,
          },
          as: "s_triage",
        }),
        s.db.add({
          table: operators,
          row: {
            email: "sam.super@bank.example",
            password: "disputes-demo",
            name: "Sam Okafor",
            kind: "human",
            role: "supervisor",
            resolve_limit_cents: 500000,
          },
        }),
        s.db.add({
          table: operators,
          row: {
            email: "aria.agent@bank.example",
            password: "disputes-demo",
            name: "Aria (AI agent)",
            kind: "agent",
            role: "resolver",
            resolve_limit_cents: 20000,
          },
        }),

        // Transactions.
        s.db.add({
          table: transactions,
          row: {
            account_ref: "AC-4021",
            merchant: "Northwind Electronics",
            amount_cents: 40000,
            occurred_at: c.now(),
            card_last4: "4417",
          },
          as: "txn1",
        }),
        s.db.add({
          table: transactions,
          row: {
            account_ref: "AC-4021",
            merchant: "Blue Bottle Coffee",
            amount_cents: 12000,
            occurred_at: c.now(),
            card_last4: "4417",
          },
          as: "txn2",
        }),
        s.db.add({
          table: transactions,
          row: {
            account_ref: "AC-7788",
            merchant: "CityRail Passes",
            amount_cents: 8000,
            occurred_at: c.now(),
            card_last4: "9921",
          },
          as: "txn3",
        }),
        s.db.add({
          table: transactions,
          row: {
            account_ref: "AC-7788",
            merchant: "Harbor Freight Depot",
            amount_cents: 30000,
            occurred_at: c.now(),
            card_last4: "9921",
          },
          as: "txn4",
        }),
        s.db.add({
          table: transactions,
          row: {
            account_ref: "AC-5150",
            merchant: "Summit Outdoor Gear",
            amount_cents: 15000,
            occurred_at: c.now(),
            card_last4: "3060",
          },
          as: "txn5",
        }),

        // The governed policy, one row per reason code.
        s.db.add({
          table: decisionRules,
          row: {
            reason_code: "fraud",
            max_auto_resolve_cents: 25000,
            allowed_resolution: "refund",
            requires_role: "resolver",
          },
        }),
        s.db.add({
          table: decisionRules,
          row: {
            reason_code: "duplicate",
            max_auto_resolve_cents: 50000,
            allowed_resolution: "refund",
            requires_role: "resolver",
          },
        }),
        s.db.add({
          table: decisionRules,
          row: {
            reason_code: "not_received",
            max_auto_resolve_cents: 20000,
            allowed_resolution: "refund",
            requires_role: "resolver",
          },
        }),
        s.db.add({
          table: decisionRules,
          row: {
            reason_code: "incorrect_amount",
            max_auto_resolve_cents: 15000,
            allowed_resolution: "partial",
            requires_role: "resolver",
          },
        }),

        // Open disputes. d1 and d4 are over their rule ceilings (the "needs a
        // supervisor" cases); d2, d3, d5 sit under the ceiling.
        s.db.add({
          table: disputes,
          row: {
            transaction_id: ref("txn1.id"),
            reason_code: "fraud",
            amount_cents: 40000,
            status: "open",
            opened_by: ref("s_triage.id"),
          },
          as: "d1",
        }),
        s.db.add({
          table: disputes,
          row: {
            transaction_id: ref("txn2.id"),
            reason_code: "duplicate",
            amount_cents: 12000,
            status: "open",
            opened_by: ref("s_triage.id"),
          },
          as: "d2",
        }),
        s.db.add({
          table: disputes,
          row: {
            transaction_id: ref("txn3.id"),
            reason_code: "not_received",
            amount_cents: 8000,
            status: "open",
            opened_by: ref("s_triage.id"),
          },
          as: "d3",
        }),
        s.db.add({
          table: disputes,
          row: {
            transaction_id: ref("txn4.id"),
            reason_code: "incorrect_amount",
            amount_cents: 30000,
            status: "open",
            opened_by: ref("s_triage.id"),
          },
          as: "d4",
        }),
        s.db.add({
          table: disputes,
          row: {
            transaction_id: ref("txn5.id"),
            reason_code: "fraud",
            amount_cents: 15000,
            status: "open",
            opened_by: ref("s_triage.id"),
          },
          as: "d5",
        }),

        // One "open" audit row per dispute, so every trail starts populated.
        s.db.add({
          table: disputeActions,
          row: {
            dispute_id: ref("d1.id"),
            actor_id: ref("s_triage.id"),
            actor_kind: "human",
            action: "open",
            detail: "Dispute opened from the ops queue.",
          },
        }),
        s.db.add({
          table: disputeActions,
          row: {
            dispute_id: ref("d2.id"),
            actor_id: ref("s_triage.id"),
            actor_kind: "human",
            action: "open",
            detail: "Dispute opened from the ops queue.",
          },
        }),
        s.db.add({
          table: disputeActions,
          row: {
            dispute_id: ref("d3.id"),
            actor_id: ref("s_triage.id"),
            actor_kind: "human",
            action: "open",
            detail: "Dispute opened from the ops queue.",
          },
        }),
        s.db.add({
          table: disputeActions,
          row: {
            dispute_id: ref("d4.id"),
            actor_id: ref("s_triage.id"),
            actor_kind: "human",
            action: "open",
            detail: "Dispute opened from the ops queue.",
          },
        }),
        s.db.add({
          table: disputeActions,
          row: {
            dispute_id: ref("d5.id"),
            actor_id: ref("s_triage.id"),
            actor_kind: "human",
            action: "open",
            detail: "Dispute opened from the ops queue.",
          },
        }),
      ],
    }),

    // Fetch the three identities (works whether just seeded or pre-existing).
    s.db.query({
      table: operators,
      where: and(
        expr(col("kind"), "=", c.text("human")),
        expr(col("role"), "=", c.text("triage")),
      ),
      returnType: "single",
      as: "op_triage",
    }),
    s.db.query({
      table: operators,
      where: and(
        expr(col("kind"), "=", c.text("human")),
        expr(col("role"), "=", c.text("supervisor")),
      ),
      returnType: "single",
      as: "op_super",
    }),
    s.db.query({
      table: operators,
      where: expr(col("kind"), "=", c.text("agent")),
      returnType: "single",
      as: "op_agent",
    }),

    // A fresh browse token per identity (the identity switcher uses these).
    s.security.create_auth_token({
      table: operators,
      id: ref("op_triage.id"),
      as: "tok_triage",
    }),
    s.security.create_auth_token({
      table: operators,
      id: ref("op_super.id"),
      as: "tok_super",
    }),
    s.security.create_auth_token({
      table: operators,
      id: ref("op_agent.id"),
      as: "tok_agent",
    }),

    // Return the transactions so the "open a dispute" form can list them.
    s.db.query({
      table: transactions,
      sort: [{ sortBy: "id", dir: "asc" }],
      as: "all_txns",
    }),
  ],
  response: {
    transactions: ref("all_txns"),
    triage: obj({
      id: ref("op_triage.id"),
      name: ref("op_triage.name"),
      email: ref("op_triage.email"),
      kind: ref("op_triage.kind"),
      role: ref("op_triage.role"),
      resolve_limit_cents: ref("op_triage.resolve_limit_cents"),
      token: ref("tok_triage"),
    }),
    supervisor: obj({
      id: ref("op_super.id"),
      name: ref("op_super.name"),
      email: ref("op_super.email"),
      kind: ref("op_super.kind"),
      role: ref("op_super.role"),
      resolve_limit_cents: ref("op_super.resolve_limit_cents"),
      token: ref("tok_super"),
    }),
    agent: obj({
      id: ref("op_agent.id"),
      name: ref("op_agent.name"),
      email: ref("op_agent.email"),
      kind: ref("op_agent.kind"),
      role: ref("op_agent.role"),
      resolve_limit_cents: ref("op_agent.resolve_limit_cents"),
      token: ref("tok_agent"),
    }),
  },
});

export type SeedResponse = import("@xanots/core").InferResponse<
  typeof seedQuery
>;
