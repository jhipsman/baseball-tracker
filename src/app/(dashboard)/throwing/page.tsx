import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { playerToday } from "@/lib/player";
import { formatGameDate } from "@/lib/games";
import { loadTeam } from "@/lib/team";
import { loadHealth } from "@/lib/health-data";
import { LANES, type Lane, type PlayerHealth } from "@/lib/health";
import { ArmFeelChip } from "@/components/throwing/status";
import { HandleAlert } from "@/components/health/alert-actions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Player Health" };

const LANE_STYLE: Record<Lane, { icon: string; pill: string }> = {
  attention: { icon: "⚠", pill: "bg-amber-100 text-amber-900" },
  out: { icon: "⛔", pill: "bg-red-100 text-red-800" },
  limited: { icon: "◐", pill: "bg-orange-50 text-orange-900" },
  resting: { icon: "⏸", pill: "bg-sky-100 text-sky-900" },
  ready: { icon: "✓", pill: "bg-brand-100 text-brand-900" },
};

function PlayerCard({ h }: { h: PlayerHealth }) {
  const style = LANE_STYLE[h.lane];
  return (
    <li className="rounded-2xl bg-surface p-3 ring-1 ring-zinc-200">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full font-bold",
            style.pill,
          )}
        >
          {style.icon}
        </span>
        <div className="min-w-0 flex-1">
          <Link href={`/throwing/${h.id}`} className="block truncate font-semibold hover:underline">
            {h.name}
          </Link>
          <p className="text-sm text-zinc-600">{h.detail}</p>
        </div>
        {h.feel ? <ArmFeelChip feel={h.feel.feel} /> : null}
      </div>
      {h.lane === "attention" ? (
        <ul className="mt-2 space-y-2 border-t border-zinc-100 pt-2">
          {h.open.map((a) => (
            <li key={a.key} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className={a.level === "critical" ? "text-red-800" : "text-amber-900"}>
                {a.level === "critical" ? "⛔ " : "⚠ "}
                {a.message}
              </span>
              <HandleAlert playerId={h.id} alertKey={a.key} />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default async function HealthTodayPage({ searchParams }: PageProps<"/throwing">) {
  const { supabase, org, isStaff } = await requireActiveOrg();
  if (!isStaff) redirect("/player/throwing");
  const { today } = await playerToday();
  const sp = await searchParams;
  const groupId = typeof sp.group === "string" ? sp.group : "";

  const team = await loadTeam(supabase, org.id, today, today, today);
  const group = team.groups.find((g) => g.id === groupId);
  const players = team.players.filter((p) => !group || group.memberIds.includes(p.id));
  const { health } = await loadHealth(supabase, org.id, players, today);
  const byLane = (lane: Lane) =>
    health.filter((h) => h.lane === lane).sort((a, b) => a.name.localeCompare(b.name));
  const checkedIn = health.filter((h) => h.checkedInToday).length;
  const missing = health.filter((h) => !h.checkedInToday && h.lane !== "out");

  return (
    <div className="max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">Player Health</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {formatGameDate(today, { weekday: "long", month: "long" })} · who&apos;s ready, who needs
          a look.
        </p>
      </div>

      {team.groups.length > 0 ? (
        <div className="flex flex-wrap gap-2 text-sm">
          {[{ id: "", name: "All players" }, ...team.groups].map((g) => (
            <Link
              key={g.id || "all"}
              href={g.id ? `/throwing?group=${g.id}` : "/throwing"}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full px-4 font-medium ring-1 ring-inset",
                g.id === groupId
                  ? "bg-zinc-900 text-zinc-50 ring-zinc-900"
                  : "bg-surface text-zinc-700 ring-zinc-300 hover:bg-zinc-50",
              )}
            >
              {g.name}
            </Link>
          ))}
        </div>
      ) : null}

      {players.length === 0 ? (
        <p className="rounded-2xl bg-surface p-5 text-sm text-zinc-600 ring-1 ring-zinc-200">
          No players yet. Invite your team from Team → Members &amp; invites.
        </p>
      ) : (
        <>
          <section
            aria-label="Arm check-ins today"
            className="rounded-2xl bg-surface p-4 ring-1 ring-zinc-200"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">
                {checkedIn} of {health.length} checked in on their arm today
              </h2>
              <span className="text-sm text-zinc-500">
                Players tap one button on their home page
              </span>
            </div>
            <div
              className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={health.length}
              aria-valuenow={checkedIn}
              aria-label="Check-ins"
            >
              <div
                className="h-full rounded-full bg-brand-600"
                style={{ width: `${(checkedIn / Math.max(1, health.length)) * 100}%` }}
              />
            </div>
            {missing.length > 0 && checkedIn < health.length ? (
              <p className="mt-2 text-sm text-zinc-600">
                Not yet: {missing.map((h) => h.name.split(" ")[0]).join(", ")}
              </p>
            ) : null}
          </section>

          {LANES.map((lane) => {
            const list = byLane(lane.key);
            if (!list.length && lane.key !== "attention") return null;
            return (
              <section key={lane.key} aria-labelledby={`lane-${lane.key}`} className="space-y-2">
                <h2 id={`lane-${lane.key}`} className="flex items-baseline gap-2">
                  <span className="text-lg font-semibold">{lane.title}</span>
                  <span className="text-sm text-zinc-500">
                    {list.length} · {lane.hint}
                  </span>
                </h2>
                {list.length ? (
                  <ul
                    className={cn(
                      "grid gap-2",
                      lane.key === "attention" ? "lg:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3",
                    )}
                  >
                    {list.map((h) => (
                      <PlayerCard key={h.id} h={h} />
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-2xl bg-surface p-4 text-sm text-zinc-600 ring-1 ring-zinc-200">
                    ✓ Nothing new. Alerts show up here when a player reports pain or soreness, goes
                    over a pitch limit, or throws a lot more than usual.
                  </p>
                )}
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
