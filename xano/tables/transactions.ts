import { table, f } from "@xanots/core";

/** Transactions — the card charges a dispute is opened against. */
export const transactions = table({
  name: "transactions",
  schema: {
    account_ref: f.text({ required: true }),
    merchant: f.text({ required: true }),
    amount_cents: f.int({ required: true }),
    occurred_at: f.timestamp({ required: true }),
    card_last4: f.text({ required: true }),
  },
});
