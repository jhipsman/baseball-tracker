import Link from "next/link";
import { playerToday } from "@/lib/player";
import { loadPayRange, requireStaffPay } from "@/lib/staff-data";
import { day, hours, PAY_METHODS, periodPresets } from "@/lib/staff-pay";
import { money } from "@/lib/team-payments";
import { PayForm } from "@/components/staff/controls";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Pay" };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function Pay({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const ctx = await requireStaffPay(true);
  const { today } = await playerToday();
  const presets = periodPresets(today);
  const sp = await searchParams;
  const fallback = presets.find((p) => p.key === "last-2-weeks")!;
  let from = DATE.test(sp.from ?? "") ? sp.from! : fallback.from;
  let to = DATE.test(sp.to ?? "") ? sp.to! : fallback.to;
  if (to < from) [from, to] = [to, from];

  const { staff, people, totals, periods, overlap, paidRows } = await loadPayRange(ctx, from, to);
  const owed = totals.filter((t) => t.payCents > 0 || t.minutes > 0);
  const totalCents = owed.reduce((s, t) => s + t.payCents, 0);
  const waiting = owed.reduce((s, t) => s + t.pendingCount, 0);
  const name = new Map([...staff, ...people].map((p) => [p.id, p.name]));
  const qs = `from=${from}&to=${to}`;

  return (
    <div className="max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">Pay</h1>
        <p className="mt-1 text-sm text-zinc-600">
          What each coach is owed for approved time and stipends. Pay them however you already do,
          then mark it paid here.
        </p>
      </header>

      <section aria-label="Pay period" className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {presets.map((p) => {
            const on = p.from === from && p.to === to;
            return (
              <Link
                key={p.key}
                href={`/staff/pay?from=${p.from}&to=${p.to}`}
                aria-current={on ? "true" : undefined}
                className={cn(
                  "shrink-0 rounded-full px-4 py-2 text-sm font-medium ring-1",
                  on
                    ? "bg-zinc-900 text-zinc-50 ring-zinc-900"
                    : "bg-surface text-zinc-700 ring-zinc-200 hover:bg-zinc-50",
                )}
              >
                {p.label}
              </Link>
            );
          })}
        </div>
        <form className="flex flex-wrap items-end gap-2" action="/staff/pay">
          <label className="space-y-1.5 text-sm font-medium text-zinc-800">
            <span className="block">From</span>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="block h-11 rounded-lg bg-surface px-3 text-zinc-900 ring-1 ring-zinc-300 ring-inset"
            />
          </label>
          <label className="space-y-1.5 text-sm font-medium text-zinc-800">
            <span className="block">To</span>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="block h-11 rounded-lg bg-surface px-3 text-zinc-900 ring-1 ring-zinc-300 ring-inset"
            />
          </label>
          <button type="submit" className={buttonClass("secondary")}>
            Show
          </button>
        </form>
      </section>

      <section className="rounded-2xl bg-surface ring-1 ring-zinc-200">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 p-4">
          <div>
            <h2 className="font-semibold">
              {day(from)} – {day(to)}
            </h2>
            <p className="text-sm text-zinc-600 tabular-nums">
              {money(totalCents)} to pay
              {waiting ? ` · ${waiting} still waiting for approval` : ""}
            </p>
          </div>
          {owed.length ? (
            <a href={`/staff/pay/export?${qs}`} className={buttonClass("secondary")} download>
              Export CSV
            </a>
          ) : null}
        </header>
        {owed.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-zinc-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Coach</th>
                  <th className="px-4 py-2 text-right font-medium">Hours</th>
                  <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">
                    Approved time
                  </th>
                  <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">Stipend</th>
                  <th className="px-4 py-2 text-right font-medium">To pay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 tabular-nums">
                {owed.map((t) => (
                  <tr key={t.profileId}>
                    <td className="px-4 py-3">
                      <span className="font-medium">{name.get(t.profileId)}</span>
                      {t.pendingCount ? (
                        <Link
                          href="/staff/timesheets"
                          className="block text-xs font-semibold text-amber-900"
                        >
                          {t.pendingCount} not approved yet ({money(t.pendingCents)})
                        </Link>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {hours(t.minutes)}
                      {t.sessions ? (
                        <span className="block text-xs text-zinc-500">{t.sessions} sessions</span>
                      ) : null}
                    </td>
                    <td className="hidden px-4 py-3 text-right sm:table-cell">
                      {money(t.approvedCents)}
                    </td>
                    <td className="hidden px-4 py-3 text-right sm:table-cell">
                      {t.stipendCents ? money(t.stipendCents) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {money(t.payCents)}
                      {t.stipendCents ? (
                        <span className="block text-xs font-normal text-zinc-500 sm:hidden">
                          incl. {money(t.stipendCents)} stipend
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-4 text-sm text-zinc-600">
            Nothing to pay in these dates.{" "}
            {people.length === 0 ? (
              <Link href="/staff/setup" className="font-semibold text-brand-700">
                Set up how coaches are paid →
              </Link>
            ) : null}
          </p>
        )}
        {owed.length ? (
          <div className="border-t border-zinc-200 p-4">
            {overlap ? (
              <p className="mb-3 text-sm text-zinc-600">
                You already paid {day(overlap.starts_on)} – {day(overlap.ends_on)}. This is time
                approved after that; stipends aren&apos;t included again.
              </p>
            ) : null}
            {totalCents > 0 ? (
              <PayForm
                from={from}
                to={to}
                total={money(totalCents)}
                payments={owed
                  .filter((t) => t.payCents > 0)
                  .map((t) => ({ profileId: t.profileId, cents: t.payCents }))}
              />
            ) : (
              <p className="text-sm text-zinc-600">Approve time to see what&apos;s owed.</p>
            )}
          </div>
        ) : null}
      </section>

      {overlap && paidRows.length ? (
        <section className="space-y-2">
          <h2 className="font-semibold">
            Paid {day(overlap.starts_on)} – {day(overlap.ends_on)}
          </h2>
          <ul className="divide-y divide-zinc-200 rounded-2xl bg-surface ring-1 ring-zinc-200">
            {paidRows.map((p) => (
              <li key={p.profile_id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm">
                  <b className="font-medium">{name.get(p.profile_id) ?? "Former staff"}</b>
                  <span className="block text-xs text-zinc-500">
                    {PAY_METHODS.find((m) => m.key === p.method)?.label}
                    {p.reference ? ` · ${p.reference}` : ""}
                  </span>
                </span>
                <b className="tabular-nums">{money(p.amount_cents)}</b>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {periods.some((p) => p.status === "paid") ? (
        <section className="space-y-2">
          <h2 className="font-semibold">Paid before</h2>
          <ul className="divide-y divide-zinc-200 rounded-2xl bg-surface ring-1 ring-zinc-200">
            {periods
              .filter((p) => p.status === "paid")
              .map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <Link
                    href={`/staff/pay?from=${p.starts_on}&to=${p.ends_on}`}
                    className="text-sm font-medium"
                  >
                    {day(p.starts_on)} – {day(p.ends_on)}
                  </Link>
                  <a
                    href={`/staff/pay/export?from=${p.starts_on}&to=${p.ends_on}&paid=1`}
                    className="text-sm font-semibold text-brand-700"
                    download
                  >
                    CSV
                  </a>
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
