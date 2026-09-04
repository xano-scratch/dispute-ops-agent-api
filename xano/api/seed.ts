import { query, input, s, c, ref, inp, expr } from "@xanots/sdk";
import { disputeApi } from "./dispute.js";
import { operators } from "../tables/operators.js";
import { transactions } from "../tables/transactions.js";
import { decision_rules } from "../tables/decision_rules.js";
import { disputes } from "../tables/disputes.js";
import { agent_runs } from "../tables/agent_runs.js";
import { dispute_actions } from "../tables/dispute_actions.js";

// Demo credentials — deliberately public fixtures for an ephemeral. Never a real secret.
const OP_OUT = ["id", "name", "email", "kind", "role", "resolve_limit_cents"] as const;

/**
 * Idempotent bootstrap. On an empty environment (or `reset: true`) it wipes and
 * repopulates operators, the decision-rule policy, transactions, and a handful of
 * disputes — two of them pre-walked through the full governed flow so the ephemeral
 * shows an interleaved human + agent audit trail at once. It always mints and returns
 * a fresh token per identity so the frontend can act as any of them.
 */
export const seedQuery = query({
  name: "seed",
  verb: "POST",
  apiGroup: disputeApi,
  input: { reset: input.bool({ required: false, default: false }) },
  stack: [
    s.db.query({ table: operators, returnType: "count", as: "op_count" }),
    s.set_var("do_seed", c.bool(false)),
    s.conditional({
      when: expr(inp("reset"), "=", c.bool(true)),
      then: [s.set_var("do_seed", c.bool(true))],
    }),
    s.conditional({
      when: expr(ref("op_count"), "=", c.int(0)),
      then: [s.set_var("do_seed", c.bool(true))],
    }),
    s.conditional({
      when: expr(ref("do_seed"), "=", c.bool(true)),
      then: [
        // Wipe children first, then parents, resetting id sequences for a stable demo.
        s.db.truncate({ table: dispute_actions, reset: true }),
        s.db.truncate({ table: agent_runs, reset: true }),
        s.db.truncate({ table: disputes, reset: true }),
        s.db.truncate({ table: decision_rules, reset: true }),
        s.db.truncate({ table: transactions, reset: true }),
        s.db.truncate({ table: operators, reset: true }),

        // Identities: two humans and one AI agent, all in the same auth table.
        s.db.add({
          table: operators,
          row: {
            email: "triage@dispute.example",
            password: "triage-demo-pass",
            name: "Tia Nguyen",
            kind: "human",
            role: "triage",
            resolve_limit_cents: 20000,
          },
          as: "op_triage",
        }),
        s.db.add({
          table: operators,
          row: {
            email: "supervisor@dispute.example",
            password: "super-demo-pass",
            name: "Sam Okafor",
            kind: "human",
            role: "supervisor",
            resolve_limit_cents: 1000000,
          },
          as: "op_super",
        }),
        s.db.add({
          table: operators,
          row: {
            email: "agent@dispute.example",
            password: "agent-demo-pass",
            name: "Triage Agent",
            kind: "agent",
            role: "resolver",
            resolve_limit_cents: 30000,
          },
          as: "op_agent",
        }),

        // The policy, one row per reason code.
        s.db.add({
          table: decision_rules,
          row: {
            reason_code: "fraud",
            max_auto_resolve_cents: 50000,
            allowed_resolution: "refund",
            requires_role: "resolver",
          },
        }),
        s.db.add({
          table: decision_rules,
          row: {
            reason_code: "duplicate",
            max_auto_resolve_cents: 40000,
            allowed_resolution: "refund",
            requires_role: "triage",
          },
        }),
        s.db.add({
          table: decision_rules,
          row: {
            reason_code: "not_received",
            max_auto_resolve_cents: 25000,
            allowed_resolution: "refund",
            requires_role: "resolver",
          },
        }),
        s.db.add({
          table: decision_rules,
          row: {
            reason_code: "incorrect_amount",
            max_auto_resolve_cents: 15000,
            allowed_resolution: "partial",
            requires_role: "supervisor",
          },
        }),

        // Transactions.
        s.db.add({
          table: transactions,
          row: {
            account_ref: "AC-4821",
            merchant: "Northwind Freight",
            amount_cents: 12750,
            occurred_at: c.now(),
            card_last4: "4412",
          },
          as: "txn1",
        }),
        s.db.add({
          table: transactions,
          row: {
            account_ref: "AC-4821",
            merchant: "Contoso Cloud",
            amount_cents: 9900,
            occurred_at: c.now(),
            card_last4: "4412",
          },
          as: "txn2",
        }),
        s.db.add({
          table: transactions,
          row: {
            account_ref: "AC-7710",
            merchant: "Fabrikam Rideshare",
            amount_cents: 3820,
            occurred_at: c.now(),
            card_last4: "9931",
          },
          as: "txn3",
        }),
        s.db.add({
          table: transactions,
          row: {
            account_ref: "AC-3092",
            merchant: "Adventure Works Travel",
            amount_cents: 82000,
            occurred_at: c.now(),
            card_last4: "2205",
          },
          as: "txn4",
        }),
        s.db.add({
          table: transactions,
          row: {
            account_ref: "AC-3092",
            merchant: "Tailspin Toys",
            amount_cents: 4599,
            occurred_at: c.now(),
            card_last4: "2205",
          },
          as: "txn5",
        }),

        // Dispute 1 (fraud, within ceiling): opened by a human, then the agent proposed a
        // refund inside policy. Left triaged so a reviewer can apply it and watch it pass.
        s.db.add({
          table: disputes,
          row: {
            transaction_id: ref("txn1.id"),
            reason_code: "fraud",
            amount_cents: 12750,
            status: "triaged",
            opened_by: ref("op_triage.id"),
          },
          as: "d1",
        }),
        s.db.add({
          table: dispute_actions,
          row: {
            dispute_id: ref("d1.id"),
            actor_id: ref("op_triage.id"),
            actor_kind: "human",
            action: "open",
            detail: c.text("Opened dispute: cardholder reports the card was not used here."),
          },
        }),
        s.db.add({
          table: agent_runs,
          row: {
            dispute_id: ref("d1.id"),
            prompt: c.text("Triage fraud dispute for Northwind Freight, 12750 cents."),
            classification: c.text(
              "Merchant and timing match a known fraud pattern; a full refund fits the fraud policy.",
            ),
            proposed_resolution: "refund",
            proposed_amount_cents: 12750,
            allowed: true,
          },
          as: "ar1",
        }),
        s.db.add({
          table: dispute_actions,
          row: {
            dispute_id: ref("d1.id"),
            actor_id: ref("op_agent.id"),
            actor_kind: "agent",
            action: "propose",
            detail: c.text("Proposed refund within the fraud auto-resolve ceiling."),
            agent_run_id: ref("ar1.id"),
          },
        }),

        // Dispute 2 (duplicate, over ceiling): the money shot. Its reason auto-resolves at the
        // triage role, so BOTH a non-supervisor human and the AI agent clear the role check, then
        // fail the SAME amount ceiling. The agent proposed a refund and was blocked by that ceiling,
        // exactly as a person is. Left triaged so a supervisor can apply it live.
        s.db.add({
          table: disputes,
          row: {
            transaction_id: ref("txn4.id"),
            reason_code: "duplicate",
            amount_cents: 82000,
            status: "triaged",
            opened_by: ref("op_triage.id"),
          },
          as: "d2",
        }),
        s.db.add({
          table: dispute_actions,
          row: {
            dispute_id: ref("d2.id"),
            actor_id: ref("op_triage.id"),
            actor_kind: "human",
            action: "open",
            detail: c.text("Opened dispute: cardholder was billed twice for the same trip."),
          },
        }),
        s.db.add({
          table: agent_runs,
          row: {
            dispute_id: ref("d2.id"),
            prompt: c.text("Triage duplicate dispute for Adventure Works Travel, 82000 cents."),
            classification: c.text(
              "The charge is a clear duplicate of an earlier booking; a full refund fits the duplicate policy.",
            ),
            proposed_resolution: "refund",
            proposed_amount_cents: 82000,
            allowed: false,
            blocked_reason: c.text(
              "Proposed refund is over the auto-resolve ceiling; a supervisor must apply it.",
            ),
          },
          as: "ar2",
        }),
        s.db.add({
          table: dispute_actions,
          row: {
            dispute_id: ref("d2.id"),
            actor_id: ref("op_agent.id"),
            actor_kind: "agent",
            action: "propose",
            detail: c.text("Proposed refund; flagged over the auto-resolve ceiling."),
            agent_run_id: ref("ar2.id"),
          },
        }),
        s.db.add({
          table: dispute_actions,
          row: {
            dispute_id: ref("d2.id"),
            actor_id: ref("op_agent.id"),
            actor_kind: "agent",
            action: "block",
            detail: c.text(
              "Blocked: a duplicate refund auto-resolves up to 40000 cents, this dispute is 82000. A supervisor must apply it.",
            ),
          },
        }),

        // Two more disputes left open, so a reviewer can run live agent triage on them.
        s.db.add({
          table: disputes,
          row: {
            transaction_id: ref("txn3.id"),
            reason_code: "not_received",
            amount_cents: 3820,
            status: "open",
            opened_by: ref("op_triage.id"),
          },
        }),
        s.db.add({
          table: disputes,
          row: {
            transaction_id: ref("txn2.id"),
            reason_code: "incorrect_amount",
            amount_cents: 9900,
            status: "open",
            opened_by: ref("op_triage.id"),
          },
        }),
      ],
    }),

    // Always mint fresh tokens for the three identities (idempotent across calls).
    s.db.get({
      table: operators,
      fieldName: "email",
      fieldValue: c.text("triage@dispute.example"),
      output: [...OP_OUT],
      as: "triage_op",
    }),
    s.security.create_auth_token({ table: operators, id: ref("triage_op.id"), as: "triage_token" }),
    s.db.get({
      table: operators,
      fieldName: "email",
      fieldValue: c.text("supervisor@dispute.example"),
      output: [...OP_OUT],
      as: "super_op",
    }),
    s.security.create_auth_token({ table: operators, id: ref("super_op.id"), as: "super_token" }),
    s.db.get({
      table: operators,
      fieldName: "email",
      fieldValue: c.text("agent@dispute.example"),
      output: [...OP_OUT],
      as: "agent_op",
    }),
    s.security.create_auth_token({ table: operators, id: ref("agent_op.id"), as: "agent_token" }),

    s.db.query({ table: transactions, sort: [{ sortBy: "id", dir: "asc" }], as: "txns" }),
    s.db.query({ table: disputes, sort: [{ sortBy: "id", dir: "asc" }], as: "disputes_list" }),
  ],
  response: {
    triage: {
      id: ref("triage_op.id"),
      name: ref("triage_op.name"),
      email: ref("triage_op.email"),
      kind: ref("triage_op.kind"),
      role: ref("triage_op.role"),
      resolve_limit_cents: ref("triage_op.resolve_limit_cents"),
      token: ref("triage_token"),
    },
    supervisor: {
      id: ref("super_op.id"),
      name: ref("super_op.name"),
      email: ref("super_op.email"),
      kind: ref("super_op.kind"),
      role: ref("super_op.role"),
      resolve_limit_cents: ref("super_op.resolve_limit_cents"),
      token: ref("super_token"),
    },
    agent: {
      id: ref("agent_op.id"),
      name: ref("agent_op.name"),
      email: ref("agent_op.email"),
      kind: ref("agent_op.kind"),
      role: ref("agent_op.role"),
      resolve_limit_cents: ref("agent_op.resolve_limit_cents"),
      token: ref("agent_token"),
    },
    transactions: ref("txns"),
    disputes: ref("disputes_list"),
  },
});
