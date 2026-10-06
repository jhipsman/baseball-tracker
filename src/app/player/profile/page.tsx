import type { Metadata } from "next";
import { requireActiveOrg } from "@/lib/org";
import { signOut } from "@/lib/auth/actions";
import { ROLE_LABELS } from "@/constants";
import { loadAssessments, seriesByMetric } from "@/lib/assessments";
import { complianceOf } from "@/lib/compliance";
import { playerToday } from "@/lib/player";
import { addDays } from "@/lib/schedule";
import { loadTeam } from "@/lib/team";
import { METRICS } from "@/constants/metrics";
import { MetricChart } from "@/components/charts/metric-chart";
import { MetricTile } from "@/components/charts/stat-tile";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage({ searchParams }: PageProps<"/player/profile">) {
  const { supabase, user, org, membership } = await requireActiveOrg();
  const sp = await searchParams;
  const { today } = await playerToday();
  const [team, assessments] = await Promise.all([
    loadTeam(supabase, org.id, addDays(today, -27), today, today),
    loadAssessments(supabase, org.id, user.id),
  ]);
  const c28 = complianceOf(team.entries.filter((e) => e.playerId === user.id));
  const series = seriesByMetric(assessments);
  const withData = METRICS.filter((m) => series.has(m.key));
  const selected =
    typeof sp.metric === "string" && series.has(sp.metric) ? sp.metric : withData[0]?.key;
  const [{ data: profile }, { data: details }] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", user.id).single(),
    supabase
      .from("org_memberships")
      .select("position, jersey_number")
      .eq("id", membership.id)
      .single(),
  ]);

  const facts = [
    ["Team", org.name],
    ["Role", ROLE_LABELS[membership.role]],
    ["Position", details?.position ?? "—"],
    ["Jersey", details?.jersey_number != null ? `#${details.jersey_number}` : "—"],
    ["Email", profile?.email ?? user.email ?? ""],
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>

      <section className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
        <p className="text-sm text-zinc-500">Consistency, last 28 days</p>
        <p className="mt-1 text-4xl font-semibold">
          {c28.rate == null ? "—" : `${Math.round(c28.rate * 100)}%`}
        </p>
        <p className="text-xs text-zinc-500">
          {c28.due ? `${c28.logged} of ${c28.due} workouts logged` : "No workouts due yet"}
        </p>
      </section>

      {withData.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-semibold">My numbers</h2>
          <div className="grid grid-cols-2 gap-2">
            {withData.map((m) => (
              <MetricTile
                key={m.key}
                metricKey={m.key}
                points={series.get(m.key)!}
                selected={m.key === selected}
                href={`/player/profile?metric=${m.key}#chart`}
              />
            ))}
          </div>
          {selected ? (
            <div id="chart" className="rounded-2xl bg-white p-3 ring-1 ring-zinc-200">
              <h3 className="text-sm font-semibold">
                {METRICS.find((m) => m.key === selected)!.label} over time
              </h3>
              <MetricChart metricKey={selected} points={series.get(selected)!} />
            </div>
          ) : null}
        </section>
      ) : null}
      <section className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
        <ProfileForm fullName={profile?.full_name ?? ""} />
      </section>
      <dl className="divide-y divide-zinc-100 rounded-2xl bg-white px-4 ring-1 ring-zinc-200">
        {facts.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-3 text-sm">
            <dt className="text-zinc-500">{k}</dt>
            <dd className="truncate font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="px-1 text-xs text-zinc-500">
        Tip: add this app to your home screen from your browser&apos;s share menu for one-tap
        access.
      </p>
      <form action={signOut}>
        <button
          type="submit"
          className="h-12 w-full rounded-xl text-sm font-semibold text-red-700 ring-1 ring-inset ring-zinc-300"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
