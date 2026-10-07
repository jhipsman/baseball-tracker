import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { playerToday } from "@/lib/player";
import { addDays } from "@/lib/schedule";
import { loadTeam } from "@/lib/team";
import { complianceOf } from "@/lib/compliance";
import { loadAssessments, seriesByMetric } from "@/lib/assessments";
import { formatMetric, METRICS } from "@/constants/metrics";
import { MetricChart } from "@/components/charts/metric-chart";
import { MetricTile } from "@/components/charts/stat-tile";
import { cn } from "@/lib/utils";
import { AssessmentForm } from "../assessment-form";
import { deleteAssessment } from "../assess-actions";
import { loadThrowing } from "@/lib/throwing";
import { ageOn, availability, dailySeries, pitchSmartBand, throwingAlerts } from "@/lib/workload";
import { ThrowsChart } from "@/components/throwing/throws-chart";
import { loadVideos } from "@/lib/videos";
import { VideoGrid } from "@/components/video/video-grid";
import {
  AlertList,
  AvailabilityBadge,
  BirthDateForm,
  ThrowingList,
} from "@/components/throwing/status";

export const metadata: Metadata = { title: "Player" };

type SetRow = {
  reps?: number | string | null;
  weight?: number | null;
  rpe?: number | null;
  done?: boolean;
};

const STATUS = {
  completed: "bg-brand-50 text-brand-900",
  partial: "bg-amber-50 text-amber-800",
  skipped: "bg-zinc-100 text-zinc-600",
} as const;

export default async function PlayerProfilePage({
  params,
  searchParams,
}: PageProps<"/roster/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, org, isStaff } = await requireActiveOrg();
  if (!isStaff) redirect("/player/profile");
  const { today } = await playerToday();

  const { data: member } = await supabase
    .from("org_memberships")
    .select(
      "profile_id, role, position, jersey_number, status, created_at, profile:profiles (full_name, email)",
    )
    .eq("org_id", org.id)
    .eq("profile_id", id)
    .maybeSingle();
  if (!member || member.role !== "player") notFound();

  const from28 = addDays(today, -27);
  const [throwing, { data: prof }, videos] = await Promise.all([
    loadThrowing(supabase, org.id, addDays(today, -60), id),
    supabase.from("profiles").select("birth_date").eq("id", id).single(),
    loadVideos(supabase, org.id, { playerId: id, limit: 6 }),
  ]);
  const birth = prof?.birth_date ?? null;
  const [team, assessments, { data: logs }] = await Promise.all([
    loadTeam(supabase, org.id, from28, today, today),
    loadAssessments(supabase, org.id, id),
    supabase
      .from("workout_logs")
      .select(
        `id, date_completed, status, overall_rpe, duration_minutes, notes, day_name,
         assignment:program_assignments!inner (program:programs!inner (name, org_id)),
         exercise_logs (exercise_id, sort_order, sets_completed, notes)`,
      )
      .eq("player_id", id)
      .eq("assignment.program.org_id", org.id)
      .order("date_completed", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const mine = team.entries.filter((e) => e.playerId === id);
  const c7 = complianceOf(mine.filter((e) => e.date >= addDays(today, -6)));
  const c28 = complianceOf(mine);
  const programs = team.assignments.filter((a) => a.playerId === id && a.status !== "completed");
  const groups = team.groups.filter((g) => g.memberIds.includes(id));

  const series = seriesByMetric(assessments);
  const withData = METRICS.filter((m) => series.has(m.key));
  const selected =
    typeof sp.metric === "string" && series.has(sp.metric) ? sp.metric : withData[0]?.key;

  const exerciseIds = [
    ...new Set((logs ?? []).flatMap((l) => l.exercise_logs.map((e) => e.exercise_id))),
  ];
  const { data: exNames } = exerciseIds.length
    ? await supabase.from("exercises").select("id, name").in("id", exerciseIds)
    : { data: [] };
  const nameOf = new Map((exNames ?? []).map((e) => [e.id, e.name]));

  const name = member.profile.full_name || member.profile.email;
  const pct = (c: { rate: number | null; logged: number; due: number }) =>
    c.rate == null ? "—" : `${Math.round(c.rate * 100)}%`;

  return (
    <div className="max-w-6xl space-y-8">
      <div>
        <Link href="/roster" className="text-xs font-medium text-zinc-500 hover:text-zinc-800">
          ← Roster
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {member.jersey_number != null ? (
              <span className="mr-2 text-zinc-400">#{member.jersey_number}</span>
            ) : null}
            {name}
          </h1>
          {member.position ? (
            <span className="rounded bg-zinc-900 px-2 py-0.5 text-xs font-semibold text-white">
              {member.position}
            </span>
          ) : null}
          {member.status !== "active" ? (
            <span
              className={cn(
                "rounded px-2 py-0.5 text-xs font-medium",
                member.status === "injured"
                  ? "bg-red-50 text-red-800"
                  : "bg-zinc-100 text-zinc-600",
              )}
            >
              {member.status === "injured" ? "Injured" : "Inactive"}
            </span>
          ) : null}
          {groups.map((g) => (
            <span
              key={g.id}
              className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-900"
            >
              {g.name}
            </span>
          ))}
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          {member.profile.email} · joined {member.created_at.slice(0, 10)}
        </p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Compliance, 7 days", value: pct(c7), sub: `${c7.logged}/${c7.due} logged` },
          {
            label: "Compliance, 28 days",
            value: pct(c28),
            sub: `${c28.logged}/${c28.due} logged · ${c28.missed} missed`,
          },
          {
            label: "Last workout",
            value: team.lastLogDate.get(id) ?? "Never",
            sub: "most recent log",
          },
          {
            label: "Active programs",
            value: String(programs.length),
            sub: programs.map((p) => p.programName).join(", ") || "None assigned",
          },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
            <dt className="text-xs text-zinc-500">{s.label}</dt>
            <dd className="mt-1 text-2xl font-semibold">{s.value}</dd>
            <dd className="mt-0.5 truncate text-xs text-zinc-500">{s.sub}</dd>
          </div>
        ))}
      </dl>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Metrics</h2>
        {withData.length === 0 ? (
          <p className="rounded-xl bg-white p-6 text-sm text-zinc-500 ring-1 ring-zinc-200">
            No assessments yet. Add one below or run a team{" "}
            <Link href="/roster/testing" className="font-semibold text-brand-700">
              testing day
            </Link>
            .
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {withData.map((m) => (
                <MetricTile
                  key={m.key}
                  metricKey={m.key}
                  points={series.get(m.key)!}
                  selected={m.key === selected}
                  href={`/roster/${id}?metric=${m.key}#chart`}
                />
              ))}
            </div>
            {selected ? (
              <div id="chart" className="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
                <h3 className="text-sm font-semibold">
                  {METRICS.find((m) => m.key === selected)!.label} over time
                </h3>
                <div className="mt-2">
                  <MetricChart metricKey={selected} points={series.get(selected)!} />
                </div>
              </div>
            ) : null}

            {/* Table view: every value, reachable without hovering. */}
            <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-zinc-200">
              <table className="w-full min-w-[40rem] text-sm">
                <caption className="px-4 pt-3 text-left text-sm font-semibold">
                  Assessment history
                </caption>
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
                    <th className="px-4 py-2 font-medium">Date</th>
                    {withData.map((m) => (
                      <th key={m.key} className="px-3 py-2 text-right font-medium">
                        {m.short}
                      </th>
                    ))}
                    <th className="px-3 py-2 font-medium">Notes</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {assessments.map((a) => (
                    <tr key={a.id} className="border-b border-zinc-100 last:border-0">
                      <td className="px-4 py-2 tabular-nums">{a.date}</td>
                      {withData.map((m) => (
                        <td key={m.key} className="px-3 py-2 text-right tabular-nums">
                          {a.metrics[m.key] != null ? (
                            formatMetric(m.key, a.metrics[m.key])
                          ) : (
                            <span className="text-zinc-300">—</span>
                          )}
                        </td>
                      ))}
                      <td className="max-w-48 truncate px-3 py-2 text-zinc-500">{a.notes}</td>
                      <td className="px-3 py-2 text-right">
                        <form action={deleteAssessment}>
                          <input type="hidden" name="id" value={a.id} />
                          <button
                            type="submit"
                            className="text-xs font-semibold text-zinc-400 hover:text-red-600"
                          >
                            Delete
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <details
          className="rounded-xl bg-white p-5 ring-1 ring-zinc-200"
          open={withData.length === 0}
        >
          <summary className="cursor-pointer font-semibold">Add assessment</summary>
          <div className="mt-4">
            <AssessmentForm playerId={id} today={today} />
          </div>
        </details>
      </section>

      <section id="videos" className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">Videos</h2>
          <Link
            href={`/videos?tab=all&player=${id}`}
            className="text-sm text-brand-700 hover:underline"
          >
            All videos / upload →
          </Link>
        </div>
        <VideoGrid videos={videos} hrefBase="/videos" showPlayer={false} empty="No videos yet." />
      </section>

      <section id="throwing" className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">Throwing</h2>
          <AvailabilityBadge a={availability(throwing, birth, today)} />
          {birth ? (
            <span className="text-sm text-zinc-500">
              Age {ageOn(birth, today)} · Pitch Smart max{" "}
              {pitchSmartBand(ageOn(birth, today)).dailyMax}/day
            </span>
          ) : null}
        </div>
        <AlertList alerts={throwingAlerts(throwing, birth, today)} />
        <div className="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
          <ThrowsChart
            days={dailySeries(throwing, from28, today)}
            dailyMax={birth ? pitchSmartBand(ageOn(birth, today)).dailyMax : null}
          />
        </div>
        <ThrowingList rows={throwing.slice(0, 10)} canDelete={() => true} />
        <details className="rounded-xl bg-white p-4 ring-1 ring-zinc-200" open={!birth}>
          <summary className="cursor-pointer text-sm font-semibold">Birthdate</summary>
          <div className="mt-3">
            <BirthDateForm
              playerId={id}
              current={birth}
              label="Birthdate (for Pitch Smart limits)"
            />
          </div>
        </details>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recent workouts</h2>
        {!logs || logs.length === 0 ? (
          <p className="rounded-xl bg-white p-6 text-sm text-zinc-500 ring-1 ring-zinc-200">
            No workouts logged yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {logs.map((l) => (
              <li key={l.id} className="rounded-xl bg-white ring-1 ring-zinc-200">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                    <span className="font-medium">{l.day_name || "Workout"}</span>
                    <span className="text-sm text-zinc-500">{l.assignment.program.name}</span>
                    <span
                      className={cn("rounded px-1.5 py-0.5 text-xs font-medium", STATUS[l.status])}
                    >
                      {l.status}
                    </span>
                    <span className="ml-auto text-sm text-zinc-500 tabular-nums">
                      {l.date_completed}
                      {l.overall_rpe != null ? ` · RPE ${l.overall_rpe}` : ""}
                      {l.duration_minutes != null ? ` · ${l.duration_minutes} min` : ""}
                    </span>
                  </summary>
                  <div className="space-y-2 border-t border-zinc-100 px-4 py-3 text-sm">
                    {l.notes ? <p className="text-zinc-700 italic">“{l.notes}”</p> : null}
                    {l.exercise_logs
                      .toSorted((a, b) => a.sort_order - b.sort_order)
                      .map((e, i) => {
                        const sets = (
                          Array.isArray(e.sets_completed) ? e.sets_completed : []
                        ) as SetRow[];
                        return (
                          <div key={i}>
                            <span className="font-medium">
                              {nameOf.get(e.exercise_id) ?? "Exercise"}
                            </span>
                            <span className="ml-2 text-zinc-600 tabular-nums">
                              {sets.length === 0
                                ? "—"
                                : sets
                                    .map(
                                      (s) =>
                                        `${s.weight != null ? `${s.weight}×` : ""}${s.reps ?? "–"}${s.rpe != null ? ` @${s.rpe}` : ""}${s.done === false ? " (not done)" : ""}`,
                                    )
                                    .join(", ")}
                            </span>
                            {e.notes ? (
                              <span className="ml-2 text-zinc-500 italic">“{e.notes}”</span>
                            ) : null}
                          </div>
                        );
                      })}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
