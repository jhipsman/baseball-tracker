import Link from "next/link";
import {
  formatGameDate,
  gameResult,
  HOME_AWAY_LABEL,
  KIND_LABEL,
  matchupLabel,
  type Game,
} from "@/lib/games";
import {
  CalendarFileLink,
  DirectionsLink,
  LineScoreTable,
  OffBanner,
  ResultChip,
  StatusBadge,
  timeLine,
} from "./game-ui";
import { LiveRefresh } from "./live-refresh";

/** Read-only game page for players and parents (phone-first). */
export function GameView({
  game: g,
  teamName,
  backHref,
  backLabel,
}: {
  game: Game;
  teamName: string;
  backHref: string;
  backLabel: string;
}) {
  const result = gameResult(g);
  const showScore = g.status === "live" || g.status === "final";
  return (
    <div className="space-y-4">
      <LiveRefresh live={g.status === "live"} />
      <Link href={backHref} className="text-sm text-zinc-500">
        ← {backLabel}
      </Link>

      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {matchupLabel(g.homeAway, g.opponent)}
          </h1>
          <StatusBadge status={g.status} />
        </div>
        <p className="text-sm text-zinc-600">
          {[
            formatGameDate(g.date, { weekday: "long", month: "long" }),
            HOME_AWAY_LABEL[g.homeAway],
            KIND_LABEL[g.kind],
            g.groupName ? `${g.groupName} only` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <OffBanner status={g.status} />

      {showScore && g.teamScore != null && g.opponentScore != null ? (
        <section className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
          <div className="flex items-center gap-2">
            {result ? <ResultChip result={result} className="size-8 text-base" /> : null}
            <span className="text-3xl font-bold tabular-nums" data-testid="game-score">
              {g.teamScore}–{g.opponentScore}
            </span>
          </div>
          <span className="text-sm font-medium text-zinc-600">
            {g.status === "live"
              ? `Inning ${g.currentInning ?? 1} · updates automatically`
              : "Final"}
          </span>
        </section>
      ) : null}

      {g.lineScore.length > 0 ? (
        <LineScoreTable game={g} teamName={teamName} currentInning={g.currentInning} />
      ) : null}

      <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
        <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-2 text-sm">
          <dt className="text-zinc-500">When</dt>
          <dd className="font-medium">{timeLine(g)}</dd>
          {g.location || g.address ? (
            <>
              <dt className="text-zinc-500">Where</dt>
              <dd>
                {g.location ? <span className="block font-medium">{g.location}</span> : null}
                {g.address ? <span className="block text-zinc-600">{g.address}</span> : null}
              </dd>
            </>
          ) : null}
          {g.tournamentName ? (
            <>
              <dt className="text-zinc-500">Tournament</dt>
              <dd className="font-medium">🏆 {g.tournamentName}</dd>
            </>
          ) : null}
        </dl>
        {g.notes ? (
          <p className="rounded-lg bg-zinc-50 p-3 text-sm whitespace-pre-line text-zinc-800">
            {g.notes}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <DirectionsLink address={g.address} location={g.location} />
          <CalendarFileLink id={g.id} />
        </div>
      </section>

      {/* BOX SCORE SLOT: stats track renders <BoxScore gameId> here */}
    </div>
  );
}
