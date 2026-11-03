import Link from "next/link";
import { playerToday } from "@/lib/player";
import { ENTRY_COLUMNS, requireStaffPay } from "@/lib/staff-data";
import {
  day,
  entryAmount,
  entryMinutes,
  hours,
  PAY_TYPES,
  STATUS_CHIP,
  STATUS_LABEL,
} from "@/lib/staff-pay";
import { money } from "@/lib/team-payments";
import {
  AddTimeForm,
  ClockCard,
  EntryActions,
  SubmitAll,
  type RecentEvent,
} from "@/components/staff/controls";

export const metadata = { title: "My time" };

const shift = (d: string, n: number) =>
  new Date(new Date(`${d}T12:00:00Z`).getTime() + n * 864e5).toISOString().slice(0, 10);

export default async function MyTime() {
  const ctx = await requireStaffPay();
  const { supabase, org, user, isAdmin } = ctx;
  const { today } = await playerToday();
  const since = shift(today, -60);
  const [{ data: entries }, { data: rate }, { data: practices }, { data: games }, { data: paid }] =
    await Promise.all([
      supabase
        .from("staff_time_entries")
        .select(`${ENTRY_COLUMNS}, practice_id, game_id`)
        .eq("org_id", org.id)
        .eq("profile_id", user.id)
        .or(`work_date.gte.${since},status.in.(open,submitted,rejected)`)
        .order("work_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("staff_pay_rates")
        .select("pay_type, rate_cents, stipend_cents, stipend_payments, title")
        .eq("org_id", org.id)
        .eq("profile_id", user.id)
        .maybeSingle(),
      supabase
        .from("practice_plans")
        .select("id, title, date")
        .eq("org_id", org.id)
        .eq("is_template", false)
        .eq("canceled", false)
        .gte("date", shift(today, -7))
        .lte("date", today)
        .order("date", { ascending: false })
        .limit(10),
      supabase
        .from("games")
        .select("id, opponent, date, home_away")
        .eq("org_id", org.id)
        .not("status", "in", "(canceled,postponed)")
        .gte("date", shift(today, -7))
        .lte("date", today)
        .order("date", { ascending: false })
        .limit(10),
      supabase
        .from("staff_payments")
        .select("id, amount_cents, paid_at, method, period_id")
        .eq("org_id", org.id)
        .eq("profile_id", user.id)
        .order("paid_at", { ascending: false })
        .limit(5),
    ]);

  const { data: paidPeriods } = paid?.length
    ? await supabase
        .from("staff_pay_periods")
        .select("id, starts_on, ends_on")
        .in(
          "id",
          paid.map((p) => p.period_id),
        )
    : { data: [] };
  const periodOf = new Map((paidPeriods ?? []).map((p) => [p.id, p]));
  const list = entries ?? [];
  const running = list.find((e) => e.kind === "shift" && e.started_at && !e.ended_at);
  const logged = new Set(list.flatMap((e) => [e.practice_id, e.game_id]).filter(Boolean));
  const recent: RecentEvent[] = [
    ...(practices ?? []).map((p) => ({
      id: p.id,
      kind: "practice" as const,
      date: p.date!,
      label: p.title || "Practice",
      minutes: 120,
    })),
    ...(games ?? []).map((g) => ({
      id: g.id,
      kind: "game" as const,
      date: g.date,
      label: `${g.home_away === "away" ? "@" : "vs"} ${g.opponent}`,
      minutes: 180,
    })),
  ]
    .filter((ev) => !logged.has(ev.id))
    .sort((a, b) => b.date.localeCompare(a.date));
  const toSend = list.filter(
    (e) => (e.status === "open" || e.status === "rejected") && (!e.started_at || e.ended_at),
  );
  const waiting = list.filter((e) => e.status === "submitted");
  const approved = list.filter((e) => e.status === "approved");
  const sum = (xs: typeof list) => xs.reduce((s, e) => s + entryAmount(e, rate ?? undefined), 0);
  const payType = PAY_TYPES.find((p) => p.key === rate?.pay_type);
  const paysForTime = rate?.pay_type === "hourly" || rate?.pay_type === "per_session";

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">My time</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {rate && payType
            ? `${rate.title ? `${rate.title} · ` : ""}${payType.label}${
                paysForTime
                  ? `, ${money(rate.rate_cents)} ${payType.unit}`
                  : rate.pay_type === "stipend"
                    ? `, ${money(rate.stipend_cents)} ${payType.unit}`
                    : ""
              }`
            : isAdmin
              ? "Log your hours here. Set how each coach is paid in Pay setup."
              : "Log your hours here. Your team admin sets up how you're paid."}
          {isAdmin && !rate ? (
            <>
              {" "}
              <Link href="/staff/setup" className="font-semibold text-brand-700">
                Pay setup →
              </Link>
            </>
          ) : null}
        </p>
      </header>

      <ClockCard startedAt={running?.started_at ?? null} />

      <dl className="grid grid-cols-3 gap-2">
        {[
          { label: "To send", n: toSend.length, cents: sum(toSend) },
          { label: "Waiting", n: waiting.length, cents: sum(waiting) },
          { label: "Approved", n: approved.length, cents: sum(approved) },
        ].map((t) => (
          <div key={t.label} className="rounded-2xl bg-surface p-3 ring-1 ring-zinc-200">
            <dt className="text-xs font-medium text-zinc-500">{t.label}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{t.n}</dd>
            {paysForTime && t.n ? (
              <dd className="text-xs text-zinc-500 tabular-nums">{money(t.cents)}</dd>
            ) : null}
          </div>
        ))}
      </dl>
      {toSend.length ? <SubmitAll count={toSend.length} /> : null}

      <section className="space-y-3 rounded-2xl bg-surface p-4 ring-1 ring-zinc-200">
        <h2 className="font-semibold">Add time</h2>
        <AddTimeForm today={today} recent={recent} />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Recent time</h2>
        {list.length ? (
          <ul className="divide-y divide-zinc-200 rounded-2xl bg-surface ring-1 ring-zinc-200">
            {list.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {day(e.work_date)}
                    {e.activity ? <span className="text-zinc-600"> · {e.activity}</span> : null}
                  </p>
                  <p className="text-sm text-zinc-500 tabular-nums">
                    {e.started_at && !e.ended_at
                      ? `Running · ${hours(entryMinutes(e))}`
                      : hours(entryMinutes(e))}
                    {e.kind === "session" ? " · 1 session" : ""}
                    {paysForTime || e.amount_cents
                      ? ` · ${money(entryAmount(e, rate ?? undefined))}`
                      : ""}
                  </p>
                  <span
                    className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      e.started_at && !e.ended_at ? STATUS_CHIP.approved : STATUS_CHIP[e.status]
                    }`}
                  >
                    {e.started_at && !e.ended_at ? "On the clock" : STATUS_LABEL[e.status]}
                  </span>
                  {e.status === "rejected" && e.review_note ? (
                    <p className="text-sm text-red-700">“{e.review_note}”</p>
                  ) : null}
                </div>

                {e.started_at && !e.ended_at ? null : <EntryActions id={e.id} status={e.status} />}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl bg-surface p-4 text-sm text-zinc-600 ring-1 ring-zinc-200">
            No time yet. Clock in, or add a practice you worked above.
          </p>
        )}
      </section>

      {paid?.length ? (
        <section className="space-y-2">
          <h2 className="font-semibold">Paid</h2>
          <ul className="divide-y divide-zinc-200 rounded-2xl bg-surface ring-1 ring-zinc-200">
            {paid.map((p) => (
              <li key={p.id} className="flex justify-between gap-3 px-4 py-3 text-sm">
                <span>
                  {periodOf.has(p.period_id)
                    ? `${day(periodOf.get(p.period_id)!.starts_on)} – ${day(periodOf.get(p.period_id)!.ends_on)}`
                    : "Pay"}
                </span>
                <b className="tabular-nums">{money(p.amount_cents)}</b>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
