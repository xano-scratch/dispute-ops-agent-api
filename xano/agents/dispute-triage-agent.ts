import { agent, input } from "@xanots/core";

/**
 * The AI triage agent. It classifies a dispute and proposes a resolution that
 * stays inside the decision-rule policy it is handed at run time. It proposes
 * only. The resolve endpoint, not the agent, applies the final resolution, and
 * the same rule layer guards that endpoint for the agent and for a human.
 *
 * Uses the platform-provided `xano-free` provider, so the app runs with no API
 * key or external credentials. The policy for the case is passed through
 * `s.ai.agent.run({ args })` and read here as `{{ $args.* }}` placeholders.
 */
export const disputeTriageAgent = agent({
  name: "dispute_triage_agent",
  description:
    "Classifies a card dispute and proposes a resolution within the decision-rule policy it is given.",
  llm: {
    type: "xano-free",
    maxSteps: 2,
    temperature: 0.1,
    systemPrompt:
      "You are a bank dispute triage assistant. You read one card dispute and return a short " +
      "classification plus the proposed resolution. You must stay inside the policy you are given. " +
      "The only resolution allowed for this reason code is {{ $args.allowed_resolution }}, so set " +
      "proposed_resolution to {{ $args.allowed_resolution }}. Keep classification to one plain sentence " +
      "that names the likely cause. The resolution amount is decided by policy, not by you.",
    prompt:
      "Reason code: {{ $args.reason_code }}. Merchant: {{ $args.merchant }}. " +
      "Dispute amount in cents: {{ $args.amount_cents }}. " +
      "Classify this dispute and propose the allowed resolution now.",
  },
  // Structured output: the endpoint reads these straight off `run.result.*`. The
  // agent proposes the resolution TYPE; the endpoint derives the amount from it,
  // so a model cannot invent a figure that dodges the ceiling check.
  output: {
    schema: {
      classification: input.text({ required: true }),
      proposed_resolution: input.enum(["refund", "deny", "partial"], {
        required: true,
      }),
    },
  },
});
