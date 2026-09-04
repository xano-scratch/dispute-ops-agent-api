/** Display helpers. Amounts are domain data (cents held as integers). */

export function money(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function when(epochMs: number | null | undefined): string {
  if (!epochMs) return "";
  try {
    return new Date(epochMs).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function label(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}
