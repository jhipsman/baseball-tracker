import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { playerToday } from "@/lib/player";
import { addDays } from "@/lib/schedule";
import { loadTeam } from "@/lib/team";
import { complianceByPlayer, needsAttention, type Compliance } from "@/lib/compliance";
import { latestByPlayer, loadAssessments } from "@/lib/assessments";
import { formatMetric, METRIC_BY_KEY, ROSTER_METRICS } from "@/constants/metrics";
import { cn } from "@/lib/utils";
import { RosterTabs } from "./tabs";

export const metadata: Metadata = { title: "Roster" };

export default async function RosterOverviewPage({ searchParams }: PageProps<"/roster">) {
  const { supabase, org, isStaff } = await requireActiveOrg();
  if (!isStaff) redirect("/roster/manage");
  const { today } = await playerToday();
  const params = await searchParams;
  const groupId = typeof params.group === "string" ? params.group : "";

  const from28 = addDays(today, -27);
  const from7 = addDays(today, -6);
  const [team, assessments] = await Promise.all([
    loadTeam(supabase, org.id, from28, today, today),
    loadAssessments(supabase, org.id),
  ]);

  const group = team.groups.find((g) => g.id === groupId);
  const players = group ? team.players.filter((p) => group.memberIds.includes(p.id)) : team.players;
  const ids = new Set(players.map((p) => p.id));
  const entries = team.entries.filter((e) => ids.has(e.playerId));

  const c7 = complianceByPlayer(entries.filter((e) => e.date >= from7));
  const c28 = complianceByPlayer(entries);
  const latest = latestByPlayer(assessments);
  const activePrograms = new Map<string, number>();
  for (const a of team.assignments) {
    if (a.status === "active" && ids.has(a.playerId)) {
      activePrograms.set(a.playerId, (activePrograms.get(a.playerId) ?? 0) + 1);
    }
  }

  const team7 = sum([...c7.values()]);
  const attention = players.filter((p) => needsAttention(c7.get(p.id)));
  const noProgram = players.filter((p) => !activePrograms.get(p.id));
  // Needs-attention players first, then by name.
  const rows = players.toSorted(
    (a, b) =>
      Number(needsAttention(c7.get(b.id))) - Number(needsAttention(c7.get(a.id))) ||
      a.name.localeCompare(b.name),
  );

  return (
    <div className="max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Roster</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {players.length} player{players.length === 1 ? "" : "s"}
          {group ? ` in ${group.name}` : ""}
        </p>
        <RosterTabs active="overview" />
      </div>

      {team.groups.length > 0 ? (
        <div className="flex flex-wrap gap-2 text-sm">
          {[{ id: "", name: "All players" }, ...team.groups].map((g) => (
            <Link
              key={g.id || "all"}
              href={g.id ? `/roster?group=${g.id}` : "/roster"}
              className={cn(
                "rounded-full px-3 py-1 font-medium ring-1 ring-inset",
                g.id === groupId
                  ? "bg-brand-700 text-white ring-brand-700"
                  : "bg-white text-zinc-700 ring-zinc-300 hover:bg-zinc-50",
              )}
            >
              {g.name}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-5 ring-1 ring-zinc-200">
          <p className="text-sm text-zinc-600">Team compliance, last 7 days</p>
          <p className="mt-1 text-5xl font-semibold text-zinc-900">
            {team7.rate == null ? "—" : `${Math.round(team7.rate * 100)}%`}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {team7.logged} of {team7.due} due workouts logged
          </p>
        </div>
        <div className="rounded-xl bg-white p-5 ring-1 ring-zinc-200">
          <p className="text-sm text-zinc-600">Need attention</p>
          <p className="mt-1 text-3xl font-semibold text-zinc-900">{attention.length}</p>
          <p className="mt-1 truncate text-xs text-zinc-500">
            {attention.length ? attention.map((p) => p.name).join(", ") : "Everyone is keeping up"}
          </p>
        </div>
        <div className="rounded-xl bg-white p-5 ring-1 ring-zinc-200">
          <p className="text-sm text-zinc-600">No active program</p>
          <p className="mt-1 text-3xl font-semibold text-zinc-900">{noProgram.length}</p>
          <p className="mt-1 truncate text-xs text-zinc-500">
            {noProgram.length ? noProgram.map((p) => p.name).join(", ") : "Everyone has a program"}
          </p>
        </div>
      </div>

      {players.length === 0 ? (
        <p className="rounded-xl bg-white p-8 text-center text-sm text-zinc-500 ring-1 ring-zinc-200">
          No players yet. Invite them from{" "}
          <Link href="/roster/manage" className="font-semibold text-brand-700">
            Members &amp; invites
          </Link>
          .
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-zinc-200">
          <table className="w-full min-w-[60rem] text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs font-medium text-zinc-500">
                <th className="px-4 py-2.5">Player</th>
                <th className="px-3 py-2.5">Last 7 days</th>
                <th className="px-3 py-2.5">Last 28 days</th>
                <th className="px-3 py-2.5">Last workout</th>
                <th className="px-3 py-2.5">Programs</th>
                {ROSTER_METRICS.map((k) => (
                  <th key={k} className="px-3 py-2.5 text-right">
                    {METRIC_BY_KEY.get(k)!.short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const flag = needsAttention(c7.get(p.id));
                const last = team.lastLogDate.get(p.id);
                return (
                  <tr
                    key={p.id}
                    className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50"
                  >
                    <td className="px-4 py-2.5">
                      <Link href={`/roster/${p.id}`} className="font-medium hover:underline">
                        {p.name}
                      </Link>
                      <span className="ml-2 text-xs text-zinc-500">{p.detail}</span>
                      {p.status !== "active" ? (
                        <span
                          className={cn(
                            "ml-2 rounded px-1.5 py-0.5 text-[11px] font-medium",
                            p.status === "injured"
                              ? "bg-red-50 text-red-800"
                              : "bg-zinc-100 text-zinc-600",
                          )}
                        >
                          {p.status === "injured" ? "Injured" : "Inactive"}
                        </span>
                      ) : null}
                      {flag ? (
                        <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-900">
                          ⚠ Needs attention
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5">
                      <Meter c={c7.get(p.id)} />
                    </td>
                    <td className="px-3 py-2.5">
                      <Meter c={c28.get(p.id)} />
                    </td>
                    <td className="px-3 py-2.5 text-zinc-600 tabular-nums">
                      {last ? relative(last, today) : <span className="text-zinc-400">Never</span>}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-600 tabular-nums">
                      {activePrograms.get(p.id) ?? 0}
                    </td>
                    {ROSTER_METRICS.map((k) => {
                      const v = latest.get(p.id)?.[k];
                      return (
                        <td key={k} className="px-3 py-2.5 text-right tabular-nums">
                          {v != null ? (
                            formatMetric(k, v)
                          ) : (
                            <span className="text-zinc-300">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function sum(list: Compliance[]) {
  const due = list.reduce((n, c) => n + c.due, 0);
  const logged = list.reduce((n, c) => n + c.logged, 0);
  return { due, logged, rate: due ? logged / due : null };
}

function relative(date: string, today: string) {
  const days = Math.round((Date.parse(today) - Date.parse(date)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days} days ago`;
  return date;
}

/** Compliance meter: fill carries severity; track is a lighter step of the same hue. */
function Meter({ c }: { c: Compliance | undefined }) {
  if (!c || c.due === 0) return <span className="text-xs text-zinc-400">Nothing due</span>;
  const pct = Math.round((c.rate ?? 0) * 100);
  const tone =
    pct >= 80
      ? { fill: "bg-brand-600", track: "bg-brand-100", label: "On track" }
      : pct >= 50
        ? { fill: "bg-amber-500", track: "bg-amber-100", label: "Slipping" }
        : { fill: "bg-red-600", track: "bg-red-100", label: "Behind" };
  return (
    <div className="flex items-center gap-2" title={`${tone.label}: ${c.logged}/${c.due} logged`}>
      <div className={cn("h-1.5 w-16 overflow-hidden rounded-full", tone.track)}>
        <div className={cn("h-full rounded-full", tone.fill)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-zinc-700 tabular-nums">
        {c.logged}/{c.due}
      </span>
      <span className="sr-only">{tone.label}</span>
    </div>
  );
}
