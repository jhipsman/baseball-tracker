import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { playerToday } from "@/lib/player";
import { addDays } from "@/lib/schedule";
import { loadTeam } from "@/lib/team";
import { complianceByPlayer, complianceOf, needsAttention } from "@/lib/compliance";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { supabase, user, org, membership } = await requireActiveOrg();
  // Players get the phone-first player app.
  if (membership.role === "player") redirect("/player");

  const { today } = await playerToday();
  const from7 = addDays(today, -6);
  const [team, { data: recent }] = await Promise.all([
    loadTeam(supabase, org.id, from7, today, today),
    supabase
      .from("workout_logs")
      .select(
        `id, date_completed, status, overall_rpe, notes, day_name, player_id,
         player:profiles!workout_logs_player_id_fkey (full_name, email),
         assignment:program_assignments!inner (program:programs!inner (name, org_id))`,
      )
      .eq("assignment.program.org_id", org.id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);
  const teamCompliance = complianceOf(team.entries);
  const perPlayer = complianceByPlayer(team.entries);
  const attention = team.players.filter((p) => needsAttention(perPlayer.get(p.id)));

  const [exercises, members, programs] = await Promise.all([
    supabase.from("exercises").select("id", { count: "exact", head: true }),
    supabase
      .from("org_memberships")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.id),
    supabase.from("programs").select("id", { count: "exact", head: true }).eq("org_id", org.id),
  ]);

  const firstName = (user.user_metadata?.full_name as string | undefined)?.split(" ")[0];
  const stats = [
    { label: "Exercises in library", value: exercises.count ?? 0, href: "/exercises" },
    { label: "Members", value: members.count ?? 0, href: "/roster" },
    { label: "Programs", value: programs.count ?? 0, href: "/programs" },
  ];

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight">
        {firstName ? `Welcome, ${firstName}` : "Welcome"}
      </h1>
      <p className="mt-1 text-sm text-zinc-600">{org.name}</p>

      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        {stats.map((s) => {
          const body = (
            <>
              <dt className="text-sm text-zinc-600">{s.label}</dt>
              <dd className="mt-1 text-3xl font-semibold tabular-nums">{s.value}</dd>
            </>
          );
          return s.href ? (
            <Link
              key={s.label}
              href={s.href}
              className="rounded-xl bg-white p-5 ring-1 ring-zinc-200 hover:ring-brand-500"
            >
              {body}
            </Link>
          ) : (
            <div key={s.label} className="rounded-xl bg-white p-5 ring-1 ring-zinc-200">
              {body}
            </div>
          );
        })}
      </dl>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl bg-white p-5 ring-1 ring-zinc-200">
          <h2 className="text-sm text-zinc-600">Team compliance, last 7 days</h2>
          <p className="mt-1 text-5xl font-semibold">
            {teamCompliance.rate == null ? "—" : `${Math.round(teamCompliance.rate * 100)}%`}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {teamCompliance.logged} of {teamCompliance.due} due workouts logged ·{" "}
            {teamCompliance.missed} missed
          </p>
          <Link href="/calendar" className="mt-3 inline-block text-sm font-semibold text-brand-700">
            Open calendar →
          </Link>
        </section>

        <section className="rounded-xl bg-white p-5 ring-1 ring-zinc-200">
          <h2 className="font-semibold">Needs attention</h2>
          {attention.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">Everyone is keeping up this week.</p>
          ) : (
            <ul className="mt-2 divide-y divide-zinc-100">
              {attention.slice(0, 6).map((p) => {
                const c = perPlayer.get(p.id)!;
                return (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <Link href={`/roster/${p.id}`} className="truncate font-medium hover:underline">
                      {p.name}
                    </Link>
                    <span className="shrink-0 text-xs text-zinc-500 tabular-nums">
                      {c.logged}/{c.due} logged · {c.missed} missed
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <Link href="/roster" className="mt-3 inline-block text-sm font-semibold text-brand-700">
            Roster overview →
          </Link>
        </section>

        <section className="rounded-xl bg-white p-5 ring-1 ring-zinc-200">
          <h2 className="font-semibold">Recent workouts</h2>
          {!recent || recent.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">No workouts logged yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-zinc-100">
              {recent.map((l) => (
                <li key={l.id} className="py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/roster/${l.player_id}`}
                      className="truncate font-medium hover:underline"
                    >
                      {l.player.full_name || l.player.email}
                    </Link>
                    <span
                      className={cn(
                        "shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium",
                        l.status === "completed"
                          ? "bg-brand-50 text-brand-900"
                          : l.status === "partial"
                            ? "bg-amber-50 text-amber-800"
                            : "bg-zinc-100 text-zinc-600",
                      )}
                    >
                      {l.status}
                    </span>
                  </div>
                  <p className="truncate text-xs text-zinc-500">
                    {l.day_name || "Workout"} · {l.assignment.program.name} · {l.date_completed}
                    {l.overall_rpe != null ? ` · RPE ${l.overall_rpe}` : ""}
                  </p>
                  {l.notes ? (
                    <p className="truncate text-xs text-zinc-600 italic">“{l.notes}”</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
