import { normalizeDate } from "@/lib/imports/parse";
export function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}
export function readCents(input: unknown): number | null {
  const s = String(input ?? "").trim();
  if (!/^\d{1,6}(?:\.\d{1,2})?$/.test(s)) return null;
  const [a, b = ""] = s.split(".");
  const cents = Number(a) * 100 + Number(b.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 10000000 ? cents : null;
}
/** Month-end dates use the original anchor, so Jan 31 -> Feb 28 -> Mar 31. */
export function installmentDates(first: string, count: number): string[] {
  if (!normalizeDate(first) || !Number.isInteger(count) || count < 1 || count > 24) return [];
  const [y, m, d] = first.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const last = new Date(Date.UTC(y, m + i, 0)).getUTCDate();
    return new Date(Date.UTC(y, m - 1 + i, Math.min(d, last))).toISOString().slice(0, 10);
  });
}
export function invoiceBalance(invoice: {
  amount_cents: number;
  paid_cents: number;
  status: string;
}) {
  return invoice.status === "open" ? Math.max(0, invoice.amount_cents - invoice.paid_cents) : 0;
}
export function readPaymentPlan(fd: FormData) {
  const s = (k: string) => String(fd.get(k) ?? "").trim();
  const cents = readCents(s("amount")),
    count = Number(s("count")),
    date = normalizeDate(s("first_due"));
  const uuid = /^[0-9a-f-]{36}$/i;
  if (!s("title") || s("title").length > 120 || !s("season") || s("season").length > 80)
    return { error: "Enter a title and season for this payment plan." } as const;
  if (!cents || cents < 100 || !Number.isInteger(count) || count < 1 || count > 24 || !date)
    return {
      error: "Choose 1–24 monthly installments of at least $1 and a valid first due date.",
    } as const;
  if (!uuid.test(s("payer_id")) || (s("player_id") && !uuid.test(s("player_id"))))
    return { error: "Choose a payer and, optionally, a player on this team." } as const;
  if (!uuid.test(s("request_id"))) return { error: "Refresh this form and try again." } as const;
  return {
    title: s("title"),
    season: s("season"),
    cents,
    count,
    date,
    payerId: s("payer_id"),
    playerId: s("player_id") || null,
    requestId: s("request_id"),
  };
}
