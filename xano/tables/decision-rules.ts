import { table, f } from "@xanots/core";

/**
 * Decision rules — the governed policy, in data. One row per reason code.
 * The resolve endpoint reads the matching row and enforces it the same way
 * for a human and for the agent identity.
 */
export const decisionRules = table({
  name: "decision_rules",
  schema: {
    reason_code: f.enum(
      ["fraud", "duplicate", "not_received", "incorrect_amount"],
      { required: true },
    ),
    // Above this ceiling a resolution needs the supervisor role.
    max_auto_resolve_cents: f.int({ required: true }),
    allowed_resolution: f.enum(["refund", "deny", "partial"], {
      required: true,
    }),
    // Minimum role that may apply a resolution for this reason.
    requires_role: f.enum(["triage", "resolver", "supervisor"], {
      required: true,
    }),
  },
  index: [{ type: "unique", fields: [{ name: "reason_code" }] }],
});
