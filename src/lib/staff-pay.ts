/**
 * Staff time & pay math (pure, no data access). Amounts are cents.
 * Hourly: minutes/60 × rate. Per session: rate per entry. Stipend: the season
 * total split into equal payments, one per pay period. Volunteer: hours only.
 */
import type { StaffPayRateRow, StaffTimeEntryRow } from "@/types/team-operations";

export type PayType = StaffPayRateRow["pay_type"];
export type Rate = Pick<
  StaffPayRateRow,
  "pay_type" | "rate_cents" | "stipend_cents" | "stipend_payments"
>;
export type Entry = Pick<
  StaffTimeEntryRow,
  "profile_id" | "kind" | "minutes" | "started_at" | "ended_at" | "status" | "amount_cents"
>;

export const PAY_TYPES: { key: PayType; label: string; unit: string }[] = [
  { key: "hourly", label: "Hourly", unit: "per hour" },
  { key: "per_session", label: "Per session", unit: "per practice, game or lesson" },
  { key: "stipend", label: "Season stipend", unit: "for the season" },
  { key: "volunteer", label: "Volunteer", unit: "unpaid; hours are still tracked" },
];

export const STATUS_LABEL: Record<StaffTimeEntryRow["status"], string> = {
  open: "Not submitted",
  submitted: "Waiting for approval",
  approved: "Approved",
  rejected: "Sent back",
  paid: "Paid",
};

/** Status chip colors (theme tokens; paid is the inverted chip). */
export const STATUS_CHIP: Record<StaffTimeEntryRow["status"], string> = {
  open: "bg-zinc-100 text-zinc-700",
  submitted: "bg-amber-50 text-amber-900",
  approved: "bg-brand-50 text-brand-900",
  rejected: "bg-red-50 text-red-700",
  paid: "bg-zinc-900 text-zinc-50",
};

/** "Tue, Nov 3" for a YYYY-MM-DD date. */
export const day = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

export const PAY_METHODS = [
  { key: "payroll", label: "Payroll (Gusto, ADP…)" },
  { key: "check", label: "Check" },
  { key: "cash", label: "Cash" },
  { key: "app", label: "Venmo, Zelle, PayPal…" },
  { key: "bank", label: "Bank transfer" },
  { key: "other", label: "Other" },
] as const;

/** Minutes worked; a running clock counts up to `now`. */
export function entryMinutes(
  e: Pick<Entry, "minutes" | "started_at" | "ended_at">,
  now = new Date(),
) {
  if (e.started_at && !e.ended_at)
    return Math.max(0, Math.round((now.getTime() - new Date(e.started_at).getTime()) / 60000));
  return e.minutes ?? 0;
}

/** What an entry is worth: the amount fixed at approval, or an estimate from the rate. */
export function entryAmount(e: Entry, rate: Rate | undefined) {
  if (e.amount_cents != null && (e.status === "approved" || e.status === "paid"))
    return e.amount_cents;
  if (!rate) return 0;
  if (rate.pay_type === "hourly") return Math.round((entryMinutes(e) * rate.rate_cents) / 60);
  if (rate.pay_type === "per_session") return rate.rate_cents;
  return 0;
}

/**
 * One stipend payment (the season total split evenly; the last payment takes the
 * remainder). Nothing once every payment has been made.
 */
export function stipendPayment(rate: Rate | undefined, paymentNumber = 1) {
  if (!rate || rate.pay_type !== "stipend" || rate.stipend_cents <= 0) return 0;
  const n = Math.max(1, rate.stipend_payments);
  if (paymentNumber > n) return 0;
  const each = Math.floor(rate.stipend_cents / n);
  return paymentNumber >= n ? rate.stipend_cents - each * (n - 1) : each;
}

export type PersonTotal = {
  profileId: string;
  minutes: number;
  sessions: number;
  approvedCents: number;
  pendingCents: number;
  pendingCount: number;
  stipendCents: number;
  /** What to pay for the period: approved time plus a stipend payment. */
  payCents: number;
};

/**
 * Totals per person for a period. Only approved (or already paid) time counts
 * toward pay; time still waiting is shown separately so nothing is missed.
 */
export function periodTotals(
  people: string[],
  entries: Entry[],
  rates: Map<string, Rate>,
  stipendPaymentNumber: (profileId: string) => number = () => 1,
): PersonTotal[] {
  return people.map((id) => {
    const mine = entries.filter((e) => e.profile_id === id && e.status !== "rejected");
    const rate = rates.get(id);
    const counted = mine.filter((e) => e.status === "approved" || e.status === "paid");
    const waiting = mine.filter((e) => e.status === "open" || e.status === "submitted");
    const approvedCents = counted.reduce((s, e) => s + entryAmount(e, rate), 0);
    const stipendCents = stipendPayment(rate, stipendPaymentNumber(id));
    return {
      profileId: id,
      minutes: mine.reduce((s, e) => s + entryMinutes(e), 0),
      sessions: mine.filter((e) => e.kind === "session").length,
      approvedCents,
      pendingCents: waiting.reduce((s, e) => s + entryAmount(e, rate), 0),
      pendingCount: waiting.length,
      stipendCents,
      payCents: approvedCents + stipendCents,
    };
  });
}

/** "6h 30m", "45m". */
export function hours(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

/** Decimal hours for payroll exports ("6.50"). */
export const decimalHours = (minutes: number) => (minutes / 60).toFixed(2);

/** Quick pay-period choices relative to today (weeks start Monday). */
export function periodPresets(today: string) {
  const d = (s: string) => new Date(`${s}T12:00:00Z`);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  const add = (s: string, n: number) => iso(new Date(d(s).getTime() + n * 864e5));
  const dow = (d(today).getUTCDay() + 6) % 7; // Monday = 0
  const monday = add(today, -dow);
  const first = `${today.slice(0, 8)}01`;
  const lastMonthEnd = add(first, -1);
  const lastMonthStart = `${lastMonthEnd.slice(0, 8)}01`;
  const monthEnd = add(
    `${iso(new Date(Date.UTC(d(today).getUTCFullYear(), d(today).getUTCMonth() + 1, 1)))}`,
    -1,
  );
  return [
    { key: "this-week", label: "This week", from: monday, to: add(monday, 6) },
    { key: "last-week", label: "Last week", from: add(monday, -7), to: add(monday, -1) },
    { key: "last-2-weeks", label: "Last 2 weeks", from: add(monday, -14), to: add(monday, -1) },
    { key: "this-month", label: "This month", from: first, to: monthEnd },
    { key: "last-month", label: "Last month", from: lastMonthStart, to: lastMonthEnd },
  ];
}

/** CSV with quoted cells (Excel, Google Sheets, Gusto and QuickBooks all read it). */
export function toCsv(rows: (string | number)[][]) {
  return rows
    .map((r) =>
      r
        .map((c) => {
          const s = String(c);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\n");
}

/** Read "$18.50", "18.5" or "18" as cents; null when it isn't a money amount. */
export function parseDollars(input: unknown) {
  const s = String(input ?? "")
    .replace(/[$,\s]/g, "")
    .trim();
  if (!s) return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}
