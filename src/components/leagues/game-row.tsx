import Link from "next/link";
import { clock, logoUrl, matchup, result } from "@/lib/leagues";
import { TeamLogo } from "./team-logo";
import { day } from "@/lib/staff-pay";
import type { PublicTeamGame } from "@/types/team-operations";
import type { TeamCard } from "@/lib/leagues-data";
import { cn } from "@/lib/utils";

const RESULT_CHIP = {
  W: "bg-brand-50 text-brand-900",
  L: "bg-red-50 text-red-700",
  T: "bg-zinc-100 text-zinc-700",
};

/** One game: date or status on the left, matchup, then score or time. */
export function GameRow({
  g,
  team,
  showDate = true,
}: {
  g: PublicTeamGame;
  team?: TeamCard;
  showDate?: boolean;
}) {
  const r = result(g);
  const live = g.status === "live";
  const off = g.status === "postponed" || g.status === "canceled";
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {team ? (
        <TeamLogo name={team.name} src={logoUrl(team.logo_path)} className="size-9 text-xs" />
      ) : null}
      <div className="min-w-0 flex-1">
        {team ? (
          <Link
            href={`/leagues/t/${team.slug}`}
            className="block truncate font-semibold hover:underline"
          >
            {team.name}
          </Link>
        ) : null}
        <p className={cn("truncate", team ? "text-sm text-zinc-600" : "font-medium")}>
          {matchup(g)}
        </p>
        <p className="truncate text-xs text-zinc-500">
          {[
            showDate ? day(g.date) : null,
            g.status === "scheduled" ? clock(g.start_time) : null,
            g.location,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      {live ? (
        <span className="text-right">
          <b className="block text-lg tabular-nums">
            {g.team_score ?? 0}–{g.opponent_score ?? 0}
          </b>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
            <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-red-600" />
            Live{g.inning ? ` · Inn ${g.inning}` : ""}
          </span>
        </span>
      ) : r ? (
        <span className="flex items-center gap-2">
          <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-bold", RESULT_CHIP[r])}>
            {r}
          </span>
          <b className="text-lg tabular-nums">
            {g.team_score}–{g.opponent_score}
          </b>
        </span>
      ) : off ? (
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
          {g.status === "postponed" ? "Postponed" : "Canceled"}
        </span>
      ) : (
        <span className="text-sm font-medium text-zinc-600">{clock(g.start_time) || "TBA"}</span>
      )}
    </div>
  );
}

export function TeamLine({ t }: { t: TeamCard }) {
  return (
    <Link
      href={`/leagues/t/${t.slug}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50"
    >
      <TeamLogo name={t.name} src={logoUrl(t.logo_path)} className="size-10 text-sm" />
      <span className="min-w-0 flex-1">
        <b className="flex items-center gap-1.5 truncate">
          {t.name}
          {t.verified ? <VerifiedBadge /> : null}
        </b>
        <span className="block truncate text-sm text-zinc-500">
          {[t.age_group, [t.city, t.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
        </span>
      </span>
      <span aria-hidden className="text-zinc-400">
        →
      </span>
    </Link>
  );
}

export function VerifiedBadge() {
  return (
    <span
      title="Scores come straight from the team's 9D app"
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-800"
    >
      ✓ On 9D
    </span>
  );
}
