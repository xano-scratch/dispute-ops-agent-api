import { table, f } from "@xanots/sdk";

/**
 * The governed policy, in data. One row per reason code: which resolution it
 * permits, the ceiling under which it auto-resolves, and the minimum role that
 * may apply it. The resolve endpoint reads this and enforces it identically for
 * a human and the AI agent.
 */
export const decision_rules = table({
  name: "decision_rules",
  schema: {
    reason_code: f.enum(["fraud", "duplicate", "not_received", "incorrect_amount"], {
      required: true,
    }),
    max_auto_resolve_cents: f.int({ required: true }),
    allowed_resolution: f.enum(["refund", "deny", "partial"], { required: true }),
    requires_role: f.enum(["triage", "resolver", "supervisor"], { required: true }),
  },
  index: [{ type: "unique", fields: [{ name: "reason_code" }] }],
});
