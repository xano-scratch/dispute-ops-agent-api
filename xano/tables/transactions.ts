import { table, f } from "@xanots/sdk";

/**
 * A card transaction that a dispute can be raised against. Reference data —
 * seeded so the ephemeral is browsable at once.
 * `id` and `created_at` are auto-injected.
 */
export const transactions = table({
  name: "transactions",
  schema: {
    account_ref: f.text({ required: true }),
    merchant: f.text({ required: true }),
    amount_cents: f.int({ required: true }),
    occurred_at: f.timestamp(),
    card_last4: f.text({ required: true }),
  },
});
