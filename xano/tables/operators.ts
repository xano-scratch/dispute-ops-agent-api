import { table, f } from "@xanots/core";

/**
 * Operators — the auth table. Both human ops staff and the AI agent identity
 * live here, so the SAME per-endpoint role guards bind a person and an agent.
 * `kind` separates a human from the agent; `role` and `resolve_limit_cents`
 * are what the resolve guard reads.
 */
export const operators = table({
  name: "operators",
  auth: true, // backs authentication (token minting + auth("id"))
  schema: {
    email: f.email({ required: true }),
    password: f.password({ required: true }),
    name: f.text({ required: true }),
    kind: f.enum(["human", "agent"], { required: true }),
    role: f.enum(["triage", "resolver", "supervisor"], { required: true }),
    // The ceiling this operator may self-resolve, in cents. 0 means none.
    resolve_limit_cents: f.int({ required: true }),
  },
  index: [{ type: "unique", fields: [{ name: "email" }] }],
});
