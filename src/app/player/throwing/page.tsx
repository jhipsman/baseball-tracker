import type { Metadata } from "next";
import { requireActiveOrg } from "@/lib/org";
import { playerToday } from "@/lib/player";
import { addDays } from "@/lib/schedule";
import { loadThrowing } from "@/lib/throwing";
import {
  acuteChronic,
  availability,
  dailySeries,
  pitchSmartBand,
  ageOn,
  throwingAlerts,
  throwsBetween,
} from "@/lib/workload";
import { PITCH_SMART_NOTE } from "@/constants/throwing";
import { ThrowLogForm } from "@/components/throwing/throw-log-form";
import { ThrowsChart } from "@/components/throwing/throws-chart";
import {
  AlertList,
  AvailabilityBadge,
  BirthDateForm,
  ThrowingList,
} from "@/components/throwing/status";

export const metadata: Metadata = { title: "Throwing" };

export default async function PlayerThrowingPage() {
  const { supabase, user, org } = await requireActiveOrg();
  const { today } = await playerToday();
  const [{ data: profile }, rows] = await Promise.all([
    supabase.from("profiles").select("birth_date").eq("id", user.id).single(),
    loadThrowing(supabase, org.id, addDays(today, -60), user.id),
  ]);
  const birth = profile?.birth_date ?? null;
  const avail = availability(rows, birth, today);
  const alerts = throwingAlerts(rows, birth, today).filter((a) => a.level !== "info");
  const week = throwsBetween(rows, addDays(today, -6), today);
  const acwr = acuteChronic(rows, today);
  const dailyMax = birth ? pitchSmartBand(ageOn(birth, today)).dailyMax : null;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Throwing</h1>

      <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-zinc-600">Pitching today</p>
          <AvailabilityBadge a={avail} size="lg" />
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-zinc-500">Throws this week</dt>
            <dd className="text-2xl font-semibold">{week}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">vs your usual week</dt>
            <dd className="text-2xl font-semibold">{acwr ? `${acwr.ratio.toFixed(1)}×` : "—"}</dd>
          </div>
        </dl>
        {!birth ? (
          <div className="rounded-lg bg-zinc-50 p-3">
            <p className="mb-2 text-sm text-zinc-700">
              Add your birthday so we can track Pitch Smart pitch limits and rest days for your age.
            </p>
            <BirthDateForm current={null} label="Birthday" />
          </div>
        ) : null}
        <AlertList alerts={alerts} />
      </section>

      <section className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
        <h2 className="mb-3 font-semibold">Log throwing or arm check-in</h2>
        <ThrowLogForm compact />
      </section>

      <section className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
        <h2 className="mb-3 font-semibold">Last 28 days</h2>
        <ThrowsChart days={dailySeries(rows, addDays(today, -27), today)} dailyMax={dailyMax} />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Recent sessions</h2>
        <ThrowingList rows={rows.slice(0, 20)} canDelete={(r) => r.loggedBy === user.id} />
      </section>

      <p className="text-xs text-zinc-500">{PITCH_SMART_NOTE}</p>
    </div>
  );
}
