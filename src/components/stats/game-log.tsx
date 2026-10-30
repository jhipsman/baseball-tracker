import Link from "next/link";
import type { GameLogEntry } from "@/lib/stats-data";
import { battingSummary, pitchingSummary } from "@/lib/stats";

const fmtDay = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

function result(g: GameLogEntry["game"]) {
  if (g.teamScore == null || g.opponentScore == null) return null;
  const r = g.teamScore > g.opponentScore ? "W" : g.teamScore < g.opponentScore ? "L" : "T";
  return `${r} ${g.teamScore}–${g.opponentScore}`;
}

/** One player's game-by-game lines, newest first. */
export function GameLog({
  log,
  gameHref,
  empty = "No games with stats yet.",
}: {
  log: GameLogEntry[];
  /** Link each game to its page (e.g. id => `/player/games/${id}`). */
  gameHref?: (gameId: string) => string;
  empty?: string;
}) {
  if (log.length === 0)
    return (
      <p className="rounded-2xl bg-surface p-4 text-sm text-zinc-500 ring-1 ring-zinc-200">
        {empty}
      </p>
    );
  return (
    <ol className="divide-y divide-zinc-100 rounded-2xl bg-surface ring-1 ring-zinc-200">
      {log.map(({ game, bat, pit }) => {
        const head = (
          <>
            <span className="w-14 shrink-0 text-sm text-zinc-500 tabular-nums">
              {fmtDay(game.date)}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">
              {game.homeAway === "away" ? "@ " : "vs "}
              {game.opponent}
              {game.kind === "scrimmage" ? (
                <span className="ml-1 text-xs font-normal text-zinc-500">(scrimmage)</span>
              ) : null}
            </span>
            {result(game) ? (
              <span className="shrink-0 text-sm text-zinc-600 tabular-nums">{result(game)}</span>
            ) : null}
          </>
        );
        return (
          <li key={game.id} className="space-y-1 px-4 py-3">
            {gameHref ? (
              <Link href={gameHref(game.id)} className="flex items-baseline gap-2 hover:underline">
                {head}
              </Link>
            ) : (
              <div className="flex items-baseline gap-2">{head}</div>
            )}
            <div className="space-y-0.5 pl-16 text-sm text-zinc-700 tabular-nums">
              {bat ? <p>{battingSummary(bat)}</p> : null}
              {pit ? (
                <p>
                  <span className="text-xs font-semibold text-zinc-500">Pitching </span>
                  {pitchingSummary(pit)}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
