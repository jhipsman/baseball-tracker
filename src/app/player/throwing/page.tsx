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
  computeThrowingPrescription,
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Supabase = Awaited<ReturnType<typeof requireActiveOrg>>["supabase"];

/**
 * The throwing day the player just finished, turned into prefill values.
 * Anything missing, malformed, or not the player's own is ignored.
 */
async function loadFinishedDay(
  supabase: Supabase,
  userId: string,
  dayId: unknown,
  assignmentId: unknown,
) {
  if (typeof dayId !== "string" || typeof assignmentId !== "string") return null;
  if (!UUID.test(dayId) || !UUID.test(assignmentId)) return null;
  const [{ data: assignment }, { data: day }] = await Promise.all([
    supabase
      .from("program_assignments")
      .select("player_id, program_id, program:programs (name)")
      .eq("id", assignmentId)
      .maybeSingle(),
    supabase
      .from("program_days")
      .select(
        `name, day_number, session_type,
         week:program_weeks!inner (program_id),
         program_exercises (exercise_id, sets, reps, intensity, notes)`,
      )
      .eq("id", dayId)
      .maybeSingle(),
  ]);
  if (
    !assignment ||
    !day ||
    assignment.player_id !== userId ||
    day.week.program_id !== assignment.program_id ||
    day.session_type !== "throwing"
  ) {
    return null;
  }
  const ids = [...new Set(day.program_exercises.map((e) => e.exercise_id))];
  const { data: exercises } = ids.length
    ? await supabase.from("exercises").select("id, name, category").in("id", ids)
    : { data: [] };
  const byId = new Map((exercises ?? []).map((e) => [e.id, e]));
  const programName = assignment.program?.name ?? null;
  const prescription = computeThrowingPrescription({
    programName,
    dayName: day.name,
    dayNumber: day.day_number,
    exercises: day.program_exercises.map((pe) => ({
      name: byId.get(pe.exercise_id)?.name ?? "",
      category: byId.get(pe.exercise_id)?.category ?? null,
      sets: pe.sets,
      reps: pe.reps,
      intensity: pe.intensity,
      notes: pe.notes,
    })),
  });
  return { label: prescription.notes, prescription };
}

export default async function PlayerThrowingPage({ searchParams }: PageProps<"/player/throwing">) {
  const { supabase, user, org } = await requireActiveOrg();
  const { today } = await playerToday();
  const { fromDay, assignment } = await searchParams;
  const [{ data: profile }, rows, finished] = await Promise.all([
    supabase.from("profiles").select("birth_date").eq("id", user.id).single(),
    loadThrowing(supabase, org.id, addDays(today, -60), user.id),
    loadFinishedDay(supabase, user.id, fromDay, assignment),
  ]);
  const birth = profile?.birth_date ?? null;
  const avail = availability(rows, birth, today);
  const alerts = throwingAlerts(rows, birth, today).filter((a) => a.level !== "info");
  const week = throwsBetween(rows, addDays(today, -6), today);
  const acwr = acuteChronic(rows, today);
  const dailyMax = birth ? pitchSmartBand(ageOn(birth, today)).dailyMax : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">Health</h1>
        <p className="text-sm text-zinc-600">Throwing &amp; arm care</p>
      </div>

      {finished ? (
        <section
          aria-label="Log your throws"
          className="space-y-3 rounded-2xl bg-surface p-4 ring-2 ring-brand-600"
        >
          <div role="status">
            <h2 className="font-semibold">Throwing day done — log your throws</h2>
            <p className="text-sm text-zinc-600">
              {finished.label ? `${finished.label}. ` : ""}We filled in what was prescribed.
              Change anything that was different, then save.
            </p>
          </div>
          <ThrowLogForm
            compact
            initial={{
              type: finished.prescription.type,
              date: today,
              pitches: finished.prescription.pitches,
              maxDistance: finished.prescription.maxDistance,
              notes: finished.prescription.notes,
            }}
          />
        </section>
      ) : null}

      <section className="space-y-3 rounded-2xl bg-surface p-4 ring-1 ring-zinc-200">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-zinc-600">Pitching today</p>
          <AvailabilityBadge a={avail} size="lg" />
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-zinc-500">Throws this week</dt>
            <dd className="text-2xl font-semibold tabular-nums">{week}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">vs your usual week</dt>
            <dd className="text-2xl font-semibold tabular-nums">
              {acwr ? `${acwr.ratio.toFixed(1)}×` : "—"}
            </dd>
            {acwr ? null : (
              <dd className="text-xs text-zinc-500">Shows after 3 weeks of logging</dd>
            )}
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

      {finished ? null : (
        <section className="rounded-2xl bg-surface p-4 ring-1 ring-zinc-200">
          <h2 className="mb-3 font-semibold">Log throwing or arm check-in</h2>
          <ThrowLogForm compact />
        </section>
      )}

      <section className="rounded-2xl bg-surface p-4 ring-1 ring-zinc-200">
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
