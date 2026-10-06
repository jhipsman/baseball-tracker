import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { playerToday } from "@/lib/player";
import { addDays } from "@/lib/schedule";
import { loadTeam } from "@/lib/team";
import { loadBirthDates, loadThrowing } from "@/lib/throwing";
import {
  acuteChronic,
  ageOn,
  availability,
  competitiveByDay,
  throwingAlerts,
  throwsBetween,
} from "@/lib/workload";
import { PITCH_SMART_NOTE } from "@/constants/throwing";
import { ThrowLogForm } from "@/components/throwing/throw-log-form";
import { AlertList, ArmFeelChip, AvailabilityBadge } from "@/components/throwing/status";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Throwing" };

export default async function ThrowingPage({ searchParams }: PageProps<"/throwing">) {
  const { supabase, org, isStaff } = await requireActiveOrg();
  if (!isStaff) redirect("/player/throwing");
  const { today } = await playerToday();
  const sp = await searchParams;
  const groupId = typeof sp.group === "string" ? sp.group : "";

  const [team, rows, births] = await Promise.all([
    loadTeam(supabase, org.id, today, today, today),
    loadThrowing(supabase, org.id, addDays(today, -60)),
    loadBirthDates(supabase, org.id),
  ]);

  const group = team.groups.find((g) => g.id === groupId);
  const players = team.players.filter((p) => !group || group.memberIds.includes(p.id));

  const summary = players.map((p) => {
    const mine = rows.filter((r) => r.playerId === p.id);
    const birth = births.get(p.id) ?? null;
    const outings = [...competitiveByDay(mine)].sort(([a], [b]) => b.localeCompare(a));
    const feel = mine.find((r) => r.armFeel);
    return {
      player: p,
      birth,
      age: birth ? ageOn(birth, today) : null,
      avail: availability(mine, birth, today),
      alerts: throwingAlerts(mine, birth, today),
      lastOuting: outings[0] ?? null,
      week: throwsBetween(mine, addDays(today, -6), today),
      acwr: acuteChronic(mine, today),
      feel,
      hasThrowing: mine.length > 0,
    };
  });
  const severity = (s: (typeof summary)[number]) =>
    s.alerts.some((a) => a.level === "critical")
      ? 2
      : s.alerts.some((a) => a.level === "warning")
        ? 1
        : 0;
  const sorted = summary.toSorted(
    (a, b) => severity(b) - severity(a) || a.player.name.localeCompare(b.player.name),
  );
  const urgent = sorted.flatMap((s) =>
    s.alerts.filter((a) => a.level !== "info").map((a) => ({ who: s.player.name, alert: a })),
  );
  const missingBirth = summary.filter((s) => !s.birth);

  return (
    <div className="max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Throwing &amp; arm care</h1>
        <p className="mt-1 max-w-3xl text-sm text-zinc-600">{PITCH_SMART_NOTE}</p>
      </div>

      {team.groups.length > 0 ? (
        <div className="flex flex-wrap gap-2 text-sm">
          {[{ id: "", name: "All players" }, ...team.groups].map((g) => (
            <Link
              key={g.id || "all"}
              href={g.id ? `/throwing?group=${g.id}` : "/throwing"}
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

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <section className="rounded-xl bg-white p-5 ring-1 ring-zinc-200">
            <h2 className="font-semibold">Alerts</h2>
            {urgent.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">No workload or arm alerts right now.</p>
            ) : (
              <div className="mt-3 space-y-1.5">
                {urgent.map((u, i) => (
                  <AlertList key={i} alerts={[u.alert]} who={u.who} />
                ))}
              </div>
            )}
            {missingBirth.length > 0 ? (
              <p className="mt-3 text-xs text-zinc-500">
                {missingBirth.length} player{missingBirth.length === 1 ? "" : "s"} without a
                birthdate, so Pitch Smart limits can&apos;t be checked:{" "}
                {missingBirth.map((s, i) => (
                  <span key={s.player.id}>
                    {i ? ", " : ""}
                    <Link
                      href={`/roster/${s.player.id}#throwing`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {s.player.name}
                    </Link>
                  </span>
                ))}
              </p>
            ) : null}
          </section>

          <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-zinc-200">
            <table className="w-full min-w-[52rem] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs font-medium text-zinc-500">
                  <th className="px-4 py-2.5">Player</th>
                  <th className="px-3 py-2.5">Age</th>
                  <th className="px-3 py-2.5">Today</th>
                  <th className="px-3 py-2.5">Last outing</th>
                  <th className="px-3 py-2.5 text-right">Throws (7d)</th>
                  <th className="px-3 py-2.5 text-right">vs usual</th>
                  <th className="px-3 py-2.5">Arm</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((s) => (
                  <tr key={s.player.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/roster/${s.player.id}#throwing`}
                        className="font-medium hover:underline"
                      >
                        {s.player.name}
                      </Link>
                      <span className="ml-2 text-xs text-zinc-500">{s.player.detail}</span>
                      {severity(s) === 2 ? (
                        <span className="ml-2 text-xs font-semibold text-red-700">⛔ Alert</span>
                      ) : severity(s) === 1 ? (
                        <span className="ml-2 text-xs font-semibold text-amber-800">⚠ Watch</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {s.age ?? <span className="text-zinc-400">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <AvailabilityBadge a={s.avail} />
                    </td>
                    <td className="px-3 py-2.5 text-zinc-600 tabular-nums">
                      {s.lastOuting ? (
                        `${s.lastOuting[0]} · ${s.lastOuting[1]} pitches`
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {s.hasThrowing ? s.week : <span className="text-zinc-400">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {s.acwr ? (
                        <span
                          className={
                            s.acwr.ratio > 1.5
                              ? "font-semibold text-red-700"
                              : s.acwr.ratio < 0.8
                                ? "text-zinc-500"
                                : ""
                          }
                        >
                          {s.acwr.ratio.toFixed(1)}×
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {s.feel ? (
                        <span className="flex items-center gap-1.5">
                          <ArmFeelChip feel={s.feel.armFeel} />
                          <span className="text-xs text-zinc-500">{s.feel.date.slice(5)}</span>
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-zinc-500">
            “vs usual” compares this week&apos;s throws to the player&apos;s average week over the
            last 4 (shown after 3 weeks of logs). Above 1.5× is a spike worth watching.
          </p>
        </div>

        <aside className="rounded-xl bg-white p-5 ring-1 ring-zinc-200 lg:self-start">
          <h2 className="mb-3 font-semibold">Log pitch counts</h2>
          {players.length === 0 ? (
            <p className="text-sm text-zinc-500">No players yet.</p>
          ) : (
            <ThrowLogForm
              players={players.map((p) => ({ id: p.id, name: p.name }))}
              defaultType="game"
            />
          )}
        </aside>
      </div>
    </div>
  );
}
