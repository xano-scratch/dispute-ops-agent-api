import { agent, input } from "@xanots/sdk";

/**
 * The AI triage agent (Play 4). It reads a dispute plus the policy the endpoint
 * hands it and proposes a resolution that fits that policy. It classifies and
 * chooses a resolution ONLY — it does not emit an amount, so the endpoint can
 * derive the payout deterministically and the ceiling check cannot be dodged by
 * a stray model output.
 *
 * Runs on the `xano-free` provider (no API key), so the ephemeral deploys and
 * runs with no external credentials.
 */
export const disputeTriageAgent = agent({
  name: "dispute_triage_agent",
  llm: {
    type: "xano-free",
    systemPrompt:
      "You are a bank card-dispute triage assistant. You read one dispute and the " +
      "policy for its reason code, then classify the dispute in one short sentence " +
      "and choose a resolution. You propose only; a human or a guarded endpoint " +
      "applies the outcome. You never argue for a payout above the policy ceiling, " +
      "and you prefer 'deny' when the facts do not support a refund.",
    prompt:
      "Dispute reason code: {{ $args.reason_code }}. Disputed amount in cents: " +
      "{{ $args.amount_cents }}. Merchant: {{ $args.merchant }}. The policy for this " +
      "reason allows the resolution '{{ $args.allowed_resolution }}' and auto-resolves " +
      "up to {{ $args.max_auto_resolve_cents }} cents without a supervisor. Classify " +
      "the dispute in one short sentence, then choose a resolution of refund, partial, " +
      "or deny that fits the policy.",
  },
  output: {
    schema: {
      classification: input.text(),
      proposed_resolution: input.enum(["refund", "partial", "deny"]),
    },
  },
});
