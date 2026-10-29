import { playerToday } from "@/lib/player";
import {
  loadPlayerGameLog,
  loadPlayerNames,
  loadSeasonLines,
  loadStatYears,
  seasonParams,
  statsViewer,
} from "@/lib/stats-data";
import { regulationInnings, seasonByPlayer } from "@/lib/stats";
import { GameLog } from "./game-log";
import { Leaders } from "./leaders";
import { PlayerSeasonLine } from "./player-season-line";
import { SeasonFilter } from "./season-filter";
import { SeasonTables } from "./season-tables";

/**
 * Phone-first stats for one player (the player themselves or a parent's
 * child): season line, game log, and the team tables when the team shares stats.
 */
export async function MyStats({
  playerId,
  firstName,
  basePath,
  extra,
  searchParams,
  gameHref,
}: {
  playerId: string;
  /** Shown for parents ("Sam's season"); omitted for the player. */
  firstName?: string;
  basePath: string;
  extra?: Record<string, string>;
  searchParams: Record<string, string | string[] | undefined>;
  gameHref: (gameId: string) => string;
}) {
  const { supabase, org, visibility } = await statsViewer();
  const { today } = await playerToday();
  const { year, includeScrimmages } = seasonParams(searchParams, today);
  const filter = { year, includeScrimmages };

  const [years, { log }, team] = await Promise.all([
    loadStatYears(supabase, org.id, Number(today.slice(0, 4))),
    loadPlayerGameLog(supabase, org.id, playerId, filter),
    visibility === "team" ? loadSeasonLines(supabase, org.id, filter) : Promise.resolve(null),
  ]);
  const names = team
    ? await loadPlayerNames(
        supabase,
        org.id,
        [...team.batting, ...team.pitching].map((l) => l.playerId),
      )
    : null;
  const seasons = team ? seasonByPlayer(team.batting, team.pitching) : [];
  const innings = team ? regulationInnings(team.games) : 7;

  return (
    <div className="space-y-5">
      <SeasonFilter
        basePath={basePath}
        years={years}
        year={year}
        includeScrimmages={includeScrimmages}
        extra={extra}
      />

      <section className="space-y-2">
        <h2 className="font-semibold">{firstName ? `${firstName}'s season` : "My season"}</h2>
        <PlayerSeasonLine
          playerId={playerId}
          orgId={org.id}
          year={year}
          includeScrimmages={includeScrimmages}
        />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Game log</h2>
        <GameLog log={log} gameHref={gameHref} empty={`No games with stats in ${year}.`} />
      </section>

      {team && names ? (
        team.games.length > 0 ? (
          <section className="space-y-3">
            <h2 className="font-semibold">Team leaders</h2>
            <Leaders
              seasons={seasons}
              names={names}
              innings={innings}
              teamGames={team.games.length}
            />
            <h2 className="pt-2 font-semibold">Team stats</h2>
            <SeasonTables
              seasons={seasons}
              names={names}
              innings={innings}
              teamGames={team.games.length}
              highlightId={playerId}
            />
          </section>
        ) : null
      ) : (
        <p className="rounded-2xl bg-white p-4 text-xs text-zinc-600 ring-1 ring-zinc-200">
          🔒 Your team keeps stats private to each family, so only{" "}
          {firstName ? `${firstName}'s` : "your"} numbers are shown here.
        </p>
      )}
    </div>
  );
}
