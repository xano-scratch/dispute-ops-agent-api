import { table, f } from "@xanots/sdk";

/**
 * The auth table. Both human ops staff and the AI agent identity live here, so
 * the SAME per-endpoint role guards bind a human and an agent caller alike.
 *
 * `role` is the permission tier (triage < resolver < supervisor); a rule's
 * `requires_role` is checked against it. `resolve_limit_cents` is the ceiling
 * this operator may self-resolve (0 means none). `kind` records whether the
 * identity is a person or the AI agent, and is copied onto every audit row.
 */
export const operators = table({
  name: "operators",
  auth: true,
  schema: {
    email: f.email({ required: true }),
    password: f.password({ required: true }),
    name: f.text({ required: true }),
    kind: f.enum(["human", "agent"], { required: true }),
    role: f.enum(["triage", "resolver", "supervisor"], { required: true }),
    resolve_limit_cents: f.int({ required: true, default: 0 }),
  },
  index: [{ type: "unique", fields: [{ name: "email" }] }],
});
