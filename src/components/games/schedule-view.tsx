import { formatRecord, recordOf, type Game, type Tournament } from "@/lib/games";
import { DirectionsLink, GameList, GameRow, TournamentSummary } from "./game-ui";

type Item =
  | { kind: "game"; date: string; game: Game }
  | { kind: "tournament"; date: string; t: Tournament; games: Game[] };

/**
 * Read-only schedule for players and parents: upcoming games (tournament
 * games grouped under their tournament), then results.
 */
export function ScheduleView({
  games,
  tournaments,
  today,
  hrefFor,
}: {
  games: Game[];
  tournaments: Tournament[];
  today: string;
  hrefFor: (g: Game) => string;
}) {
  const isUpcoming = (g: Game) => g.status === "live" || (g.date >= today && g.status !== "final");
  const upcoming = games.filter(isUpcoming);
  const results = games.filter((g) => !isUpcoming(g)).toReversed();
  const record = recordOf(games.filter((g) => g.date.startsWith(today.slice(0, 4))));

  const items: Item[] = [];
  const blocks = new Map<string, Item & { kind: "tournament" }>();
  for (const t of tournaments) {
    if (t.endDate < today) continue;
    const block = { kind: "tournament" as const, date: t.startDate, t, games: [] as Game[] };
    blocks.set(t.id, block);
    items.push(block);
  }
  for (const g of upcoming) {
    const block = g.tournamentId ? blocks.get(g.tournamentId) : undefined;
    if (block) block.games.push(g);
    else items.push({ kind: "game", date: g.date, game: g });
  }
  items.sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-600">
        {today.slice(0, 4)} record{" "}
        <span className="font-semibold text-zinc-900 tabular-nums" data-testid="season-record">
          {formatRecord(record, true)}
        </span>
      </p>

      <section className="space-y-2">
        <h2 className="font-semibold">Upcoming</h2>
        {items.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-center text-sm text-zinc-500 ring-1 ring-zinc-200">
            No games on the schedule yet. The coach&apos;s schedule shows up here.
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((item) =>
              item.kind === "game" ? (
                <ul
                  key={item.game.id}
                  className="overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200"
                >
                  <GameRow g={item.game} href={hrefFor(item.game)} today={today} />
                </ul>
              ) : (
                <div
                  key={item.t.id}
                  data-testid="tournament-block"
                  className="overflow-hidden rounded-2xl bg-white ring-1 ring-amber-200"
                >
                  <div className="space-y-2 bg-amber-50/60 p-4">
                    <TournamentSummary t={item.t} record={tournamentRecord(games, item.t.id)} />
                    <DirectionsLink address={item.t.address} location={item.t.location} />
                  </div>
                  {item.games.length > 0 ? (
                    <ul className="divide-y divide-zinc-100 border-t border-amber-100">
                      {item.games.map((g) => (
                        <GameRow key={g.id} g={g} href={hrefFor(g)} today={today} />
                      ))}
                    </ul>
                  ) : (
                    <p className="border-t border-amber-100 px-4 py-3 text-sm text-zinc-500">
                      Game times will be posted when the schedule is out.
                    </p>
                  )}
                </div>
              ),
            )}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Results</h2>
        <GameList games={results} hrefFor={hrefFor} today={today} empty="No results yet." />
      </section>

      {tournaments.some((t) => t.endDate < today) ? (
        <section className="space-y-2">
          <h2 className="font-semibold">Past tournaments</h2>
          <ul className="space-y-2">
            {tournaments
              .filter((t) => t.endDate < today)
              .toReversed()
              .map((t) => (
                <li key={t.id} className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
                  <TournamentSummary t={t} record={tournamentRecord(games, t.id)} />
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function tournamentRecord(games: Game[], id: string) {
  const r = recordOf(games.filter((g) => g.tournamentId === id));
  return r.w + r.l + r.t > 0 ? formatRecord(r) : null;
}
