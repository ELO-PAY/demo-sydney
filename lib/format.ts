// Shared display formatting, in Australian conventions (the operator and
// her clients are AU-based). Kept in one place so every admin screen reads
// the same.

export function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Sydney",
  }).format(new Date(iso));
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeZone: "Australia/Sydney",
  }).format(new Date(iso));
}

export function formatMoney(amountCents: number, currency = "AUD"): string {
  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency,
    }).format((amountCents ?? 0) / 100);
  } catch {
    // Unknown currency code — fall back to a plain number.
    return `${((amountCents ?? 0) / 100).toFixed(2)} ${currency}`;
  }
}
