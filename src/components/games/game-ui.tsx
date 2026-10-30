import Link from "next/link";
import {
  dateRangeLabel,
  directionsUrl,
  ensureInnings,
  formatGameDate,
  formatGameTime,
  gameResult,
  HOME_AWAY_LABEL,
  KIND_LABEL,
  lineTotals,
  matchupLabel,
  STATUS_LABEL,
  type Game,
  type GameStatus,
  type Result,
  type Tournament,
} from "@/lib/games";
import { cn } from "@/lib/utils";

const RESULT_STYLE: Record<Result, string> = {
  W: "bg-brand-700 text-on-brand",
  L: "bg-zinc-800 text-zinc-50",
  T: "bg-zinc-300 text-zinc-800",
};

/** "W", "L", "T" chip. */
export function ResultChip({ result, className }: { result: Result; className?: string }) {
  return (
    <span
      data-testid="result-chip"
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-bold",
        RESULT_STYLE[result],
        className,
      )}
    >
      {result}
    </span>
  );
}

const STATUS_STYLE: Partial<Record<GameStatus, string>> = {
  live: "bg-red-600 text-white",
  postponed: "bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-300",
  canceled: "bg-zinc-200 text-zinc-700 line-through",
  final: "bg-zinc-100 text-zinc-700",
};

/** LIVE / Postponed / Canceled / Final badge (nothing for plain scheduled games). */
export function StatusBadge({ status, className }: { status: GameStatus; className?: string }) {
  const style = STATUS_STYLE[status];
  if (!style) return null;
  return (
    <span
      data-testid={`status-${status}`}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold uppercase",
        style,
        className,
      )}
    >
      {status === "live" ? (
        <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-surface" />
      ) : null}
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Compact calendar-ish date block. */
export function DateBlock({ date, today }: { date: string; today: string }) {
  return (
    <div
      className={cn(
        "flex w-12 shrink-0 flex-col items-center rounded-lg py-1 text-center",
        date === today ? "bg-brand-700 text-on-brand" : "bg-zinc-100 text-zinc-800",
      )}
    >
      <span className="text-[10px] font-semibold uppercase">
        {formatGameDate(date, { weekday: "short", month: undefined, day: undefined })}
      </span>
      <span className="text-lg leading-tight font-semibold tabular-nums">
        {Number(date.slice(8))}
      </span>
      <span className="text-[10px] uppercase opacity-70">
        {formatGameDate(date, { weekday: undefined, month: "short", day: undefined })}
      </span>
    </div>
  );
}

/** "3:30 PM · arrive 2:45 PM" */
export function timeLine(g: Pick<Game, "startTime" | "arrivalTime">) {
  const start = formatGameTime(g.startTime);
  const arrive = formatGameTime(g.arrivalTime);
  return [start ?? "Time TBA", arrive ? `arrive ${arrive}` : null].filter(Boolean).join(" · ");
}

/** One game in a schedule list. */
export function GameRow({
  g,
  href,
  today,
  showGroup = true,
}: {
  g: Game;
  href: string;
  today: string;
  showGroup?: boolean;
}) {
  const result = gameResult(g);
  const off = g.status === "canceled" || g.status === "postponed";
  return (
    <li data-testid="game-row">
      <Link href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50">
        <DateBlock date={g.date} today={today} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className={cn("truncate font-semibold", off && "text-zinc-500 line-through")}>
              {matchupLabel(g.homeAway, g.opponent)}
            </p>
            <StatusBadge status={g.status === "final" ? "scheduled" : g.status} />
          </div>
          <p className="truncate text-sm text-zinc-600">
            {[g.status === "final" || g.status === "live" ? null : timeLine(g), g.location]
              .filter(Boolean)
              .join(" · ") || HOME_AWAY_LABEL[g.homeAway]}
          </p>
          <p className="truncate text-xs text-zinc-500">
            {[
              KIND_LABEL[g.kind],
              g.tournamentName,
              showGroup && g.groupName ? `${g.groupName} only` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {g.teamScore != null && g.opponentScore != null && (result || g.status === "live") ? (
          <div className="flex shrink-0 items-center gap-1.5">
            {result ? <ResultChip result={result} /> : null}
            <span className="font-semibold tabular-nums">
              {g.teamScore}–{g.opponentScore}
            </span>
          </div>
        ) : null}
      </Link>
    </li>
  );
}

export function GameList({
  games,
  hrefFor,
  today,
  empty,
  showGroup,
}: {
  games: Game[];
  hrefFor: (g: Game) => string;
  today: string;
  empty: string;
  showGroup?: boolean;
}) {
  if (games.length === 0) {
    return (
      <p className="rounded-2xl bg-surface p-6 text-center text-sm text-zinc-500 ring-1 ring-zinc-200">
        {empty}
      </p>
    );
  }
  return (
    <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl bg-surface ring-1 ring-zinc-200">
      {games.map((g) => (
        <GameRow key={g.id} g={g} href={hrefFor(g)} today={today} showGroup={showGroup} />
      ))}
    </ul>
  );
}

/** "Directions ↗" link to Google Maps (new tab), or nothing without a place. */
export function DirectionsLink({
  address,
  location,
  className,
}: {
  address: string | null;
  location: string | null;
  className?: string;
}) {
  const url = directionsUrl(address, location);
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold ring-1 ring-zinc-300 ring-inset hover:bg-zinc-50",
        className,
      )}
    >
      📍 Directions ↗
    </a>
  );
}

export function CalendarFileLink({ id, className }: { id: string; className?: string }) {
  return (
    <a
      href={`/games/${id}/ics`}
      download
      className={cn(
        "inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold ring-1 ring-zinc-300 ring-inset hover:bg-zinc-50",
        className,
      )}
    >
      📅 Add to calendar
    </a>
  );
}

/** Innings × us/them with run totals. */
export function LineScoreTable({
  game,
  teamName,
  currentInning,
}: {
  game: Pick<Game, "lineScore" | "inningsScheduled" | "opponent" | "status">;
  teamName: string;
  currentInning?: number | null;
}) {
  const line = ensureInnings(game.lineScore, game.inningsScheduled);
  const totals = lineTotals(game.lineScore);
  const live = game.status === "live";
  const cell = (i: number, v: number) => {
    const played = i < game.lineScore.length && (!live || !currentInning || i < currentInning);
    return played || v > 0 ? v : "";
  };
  return (
    <div className="overflow-x-auto rounded-xl bg-surface ring-1 ring-zinc-200">
      <table
        data-testid="line-score"
        className="w-full border-collapse text-center text-sm tabular-nums"
      >
        <thead>
          <tr className="border-b border-zinc-200 text-xs text-zinc-500">
            <th className="sticky left-0 bg-surface px-3 py-2 text-left font-medium">Team</th>
            {line.map((_, i) => (
              <th
                key={i}
                className={cn(
                  "min-w-6 px-1 py-2 font-medium",
                  live && currentInning === i + 1 && "bg-brand-50 text-brand-900",
                )}
              >
                {i + 1}
              </th>
            ))}
            <th className="border-l border-zinc-200 px-2.5 py-2 font-semibold text-zinc-800">R</th>
          </tr>
        </thead>
        <tbody>
          {(
            [
              ["us", teamName],
              ["them", game.opponent],
            ] as const
          ).map(([side, name]) => (
            <tr key={side} className="border-b border-zinc-100 last:border-0">
              <th
                scope="row"
                className="sticky left-0 max-w-24 truncate bg-surface px-3 py-2 text-left font-medium sm:max-w-40"
              >
                {name}
              </th>
              {line.map((inn, i) => (
                <td
                  key={i}
                  className={cn(
                    "px-1 py-2",
                    live && currentInning === i + 1 && "bg-brand-50 font-semibold",
                  )}
                >
                  {cell(i, inn[side])}
                </td>
              ))}
              <td
                data-testid={`runs-${side}`}
                className="border-l border-zinc-200 px-2.5 py-2 font-bold"
              >
                {totals[side]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Phone card linking to the next game. */
export function NextGameCard({
  game: g,
  today,
  href,
}: {
  game: Game;
  today: string;
  href: string;
}) {
  const when = g.date === today ? "Today" : formatGameDate(g.date);
  const live = g.status === "live";
  return (
    <Link
      href={href}
      data-testid="next-game"
      className="hero relative block overflow-hidden rounded-3xl p-5 active:opacity-90"
    >
      {/* Infield lines, for atmosphere. */}
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        className="pointer-events-none absolute -right-6 -bottom-10 size-44 text-white/10"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.2}
      >
        <path d="M50 92 12 54 50 16l38 38z" />
        <circle cx="50" cy="54" r="5" />
        <path d="M50 92 0 42M50 92l50-50" />
      </svg>
      <span className="relative flex items-center gap-2 text-xs font-semibold tracking-wide text-white/70 uppercase">
        {live ? <span className="live-dot" /> : null}
        Next game · {when}
        {live ? <span className="text-[#f5b83c]">Live</span> : null}
      </span>
      <span className="relative mt-2 block truncate text-2xl font-medium tracking-tight">
        {matchupLabel(g.homeAway, g.opponent)}
      </span>
      <span className="relative mt-1 block truncate text-sm text-white/60">
        {[timeLine(g), g.location].filter(Boolean).join(" · ")}
      </span>
      <span
        aria-hidden
        className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-full bg-white/10 text-white"
      >
        ↗
      </span>
    </Link>
  );
}

/** Tournament header block with dates, place, bracket link. */
export function TournamentSummary({
  t,
  record,
  href,
}: {
  t: Tournament;
  record?: string | null;
  href?: string;
}) {
  const title = <span className="font-semibold">🏆 {t.name}</span>;
  return (
    <div className="space-y-0.5">
      <div className="flex flex-wrap items-center gap-2">
        {href ? (
          <Link href={href} className="hover:underline">
            {title}
          </Link>
        ) : (
          title
        )}
        {record ? (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold tabular-nums">
            {record}
          </span>
        ) : null}
      </div>
      <p className="text-sm text-zinc-600">
        {[
          dateRangeLabel(t.startDate, t.endDate),
          t.location,
          t.groupName ? `${t.groupName} only` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {t.url ? (
        <a
          href={t.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-brand-700 hover:underline"
        >
          Bracket ↗
        </a>
      ) : null}
    </div>
  );
}

/** Banner for postponed / canceled games. */
export function OffBanner({ status }: { status: GameStatus }) {
  if (status !== "postponed" && status !== "canceled") return null;
  return (
    <p
      role="status"
      className={cn(
        "rounded-xl px-4 py-3 text-sm font-semibold",
        status === "postponed" ? "bg-amber-50 text-amber-900" : "bg-zinc-100 text-zinc-800",
      )}
    >
      {status === "postponed"
        ? "⏸ This game is postponed. A new date will be posted when it's set."
        : "✕ This game is canceled."}
    </p>
  );
}
