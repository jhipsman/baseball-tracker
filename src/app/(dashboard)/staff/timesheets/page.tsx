import Link from "next/link";
import { ENTRY_COLUMNS, loadRates, loadStaff, requireStaffPay } from "@/lib/staff-data";
import { day, entryAmount, entryMinutes, hours } from "@/lib/staff-pay";
import { money } from "@/lib/team-payments";
import { ReviewButtons } from "@/components/staff/controls";

export const metadata = { title: "Timesheets" };

export default async function Timesheets() {
  const ctx = await requireStaffPay(true);
  const { supabase, org } = ctx;
  const [staff, rates, { data }] = await Promise.all([
    loadStaff(ctx),
    loadRates(ctx),
    supabase
      .from("staff_time_entries")
      .select(ENTRY_COLUMNS)
      .eq("org_id", org.id)
      .in("status", ["open", "submitted"])
      .order("work_date")
      .limit(1000),
  ]);
  const entries = data ?? [];
  const name = new Map(staff.map((s) => [s.id, s.name]));
  const clockedIn = entries.filter((e) => e.kind === "shift" && e.started_at && !e.ended_at);
  const waiting = entries.filter((e) => e.status === "submitted");
  const unsent = entries.filter((e) => e.status === "open" && !(e.started_at && !e.ended_at));
  const people = [...new Set(waiting.map((e) => e.profile_id))].sort((a, b) =>
    (name.get(a) ?? "").localeCompare(name.get(b) ?? ""),
  );

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">Timesheets</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Approve time coaches sent in. Approved time is priced from their{" "}
          <Link href="/staff/setup" className="font-semibold text-brand-700">
            pay setup
          </Link>{" "}
          and shows up in{" "}
          <Link href="/staff/pay" className="font-semibold text-brand-700">
            Pay
          </Link>
          .
        </p>
      </header>

      {clockedIn.length ? (
        <p className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-900 ring-1 ring-brand-200">
          <b>On the clock now:</b>{" "}
          {clockedIn
            .map((e) => `${name.get(e.profile_id) ?? "Coach"} (${hours(entryMinutes(e))})`)
            .join(", ")}
        </p>
      ) : null}

      {people.length ? (
        people.map((id) => {
          const mine = waiting.filter((e) => e.profile_id === id);
          const rate = rates.get(id);
          const mins = mine.reduce((s, e) => s + entryMinutes(e), 0);
          const cents = mine.reduce((s, e) => s + entryAmount(e, rate), 0);
          return (
            <section key={id} className="rounded-2xl bg-surface ring-1 ring-zinc-200">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 p-4">
                <div>
                  <h2 className="font-semibold">{name.get(id) ?? "Former staff"}</h2>
                  <p className="text-sm text-zinc-600 tabular-nums">
                    {mine.length} waiting · {hours(mins)}
                    {cents ? ` · ${money(cents)}` : ""}
                    {!rate ? (
                      <>
                        {" · "}
                        <Link href="/staff/setup" className="font-semibold text-amber-900">
                          No pay setup yet
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
                {mine.length > 1 ? (
                  <ReviewButtons ids={mine.map((e) => e.id)} label={`Approve all ${mine.length}`} />
                ) : null}
              </header>
              <ul className="divide-y divide-zinc-200">
                {mine.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {day(e.work_date)}
                        {e.activity ? <span className="text-zinc-600"> · {e.activity}</span> : null}
                      </p>
                      <p className="text-sm text-zinc-500 tabular-nums">
                        {hours(entryMinutes(e))}
                        {e.kind === "session" ? " · 1 session" : ""}
                        {rate ? ` · ${money(entryAmount(e, rate))}` : ""}
                        {e.started_at && e.ended_at
                          ? ` · ${new Date(e.started_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}–${new Date(e.ended_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
                          : ""}
                      </p>
                      {e.note ? <p className="text-sm text-zinc-600">{e.note}</p> : null}
                    </div>
                    <div className="w-full sm:w-auto">
                      <ReviewButtons ids={[e.id]} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      ) : (
        <p className="rounded-2xl bg-surface p-4 text-sm text-zinc-600 ring-1 ring-zinc-200">
          Nothing waiting for approval.
          {unsent.length
            ? ` ${unsent.length} entr${unsent.length === 1 ? "y hasn't" : "ies haven't"} been sent in yet.`
            : ""}
        </p>
      )}
    </div>
  );
}
