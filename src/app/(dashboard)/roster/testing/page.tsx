import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { playerToday } from "@/lib/player";
import { loadTeam } from "@/lib/team";
import { latestByPlayer, loadAssessments } from "@/lib/assessments";
import { METRICS, METRIC_BY_KEY } from "@/constants/metrics";
import { cn } from "@/lib/utils";
import { RosterTabs } from "../tabs";
import { TestingForm } from "./testing-form";

export const metadata: Metadata = { title: "Testing day" };

const DEFAULT_METRICS = ["sixty_time", "exit_velo", "fastball_velo"];

export default async function TestingDayPage({ searchParams }: PageProps<"/roster/testing">) {
  const { supabase, org, isStaff } = await requireActiveOrg();
  if (!isStaff) redirect("/player");
  const { today } = await playerToday();
  const sp = await searchParams;

  const requested = (Array.isArray(sp.m) ? sp.m : sp.m ? [sp.m] : []).filter((k) =>
    METRIC_BY_KEY.has(k),
  );
  const metrics = requested.length ? requested : DEFAULT_METRICS;
  const groupId = typeof sp.group === "string" ? sp.group : "";

  const [team, assessments] = await Promise.all([
    loadTeam(supabase, org.id, today, today, today),
    loadAssessments(supabase, org.id),
  ]);
  const latest = latestByPlayer(assessments);
  const group = team.groups.find((g) => g.id === groupId);
  const players = team.players
    .filter((p) => p.status !== "inactive")
    .filter((p) => !group || group.memberIds.includes(p.id));

  const href = (nextMetrics: string[], g = groupId) => {
    const q = new URLSearchParams();
    for (const k of nextMetrics) q.append("m", k);
    if (g) q.set("group", g);
    return `/roster/testing?${q}`;
  };

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Roster</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Enter a whole team&apos;s results at once. Leave a box blank to skip it.
        </p>
        <RosterTabs active="testing" />
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="mr-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            Tests
          </span>
          {METRICS.map((m) => {
            const on = metrics.includes(m.key);
            const next = on ? metrics.filter((k) => k !== m.key) : [...metrics, m.key];
            return (
              <Link
                key={m.key}
                href={href(next.length ? next : metrics)}
                aria-pressed={on}
                className={cn(
                  "rounded-full px-3 py-1 font-medium ring-1 ring-inset",
                  on
                    ? "bg-brand-700 text-white ring-brand-700"
                    : "bg-white text-zinc-700 ring-zinc-300 hover:bg-zinc-50",
                )}
              >
                {m.label}
              </Link>
            );
          })}
        </div>
        {team.groups.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className="mr-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              Players
            </span>
            {[{ id: "", name: "All" }, ...team.groups].map((g) => (
              <Link
                key={g.id || "all"}
                href={href(metrics, g.id)}
                className={cn(
                  "rounded-full px-3 py-1 font-medium ring-1 ring-inset",
                  g.id === groupId
                    ? "bg-zinc-900 text-white ring-zinc-900"
                    : "bg-white text-zinc-700 ring-zinc-300 hover:bg-zinc-50",
                )}
              >
                {g.name}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      {players.length === 0 ? (
        <p className="rounded-xl bg-white p-8 text-center text-sm text-zinc-500 ring-1 ring-zinc-200">
          No active players{group ? ` in ${group.name}` : ""}.
        </p>
      ) : (
        <TestingForm
          key={metrics.join(",") + groupId}
          today={today}
          metrics={metrics}
          players={players.map((p) => ({
            id: p.id,
            name: p.name,
            detail: p.detail,
            latest: latest.get(p.id) ?? {},
          }))}
        />
      )}
    </div>
  );
}
