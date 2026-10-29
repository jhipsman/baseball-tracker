import { createClient } from "@/lib/supabase/server";
import { PA_RESULTS, type Result } from "@/lib/live/engine";
import { cn } from "@/lib/utils";

const LABEL = Object.fromEntries(PA_RESULTS.map((r) => [r.key, r.label])) as Record<Result, string>;
const LONG = Object.fromEntries(PA_RESULTS.map((r) => [r.key, r.long])) as Record<Result, string>;
const HIT = new Set<string>(["1B", "2B", "3B", "HR"]);
const ON = new Set<string>(["1B", "2B", "3B", "HR", "BB", "IBB", "HBP"]);
const K = new Set<string>(["K", "KL"]);

type Pa = { result: Result; gameId: string; date: string; opponent: string };

function rates(pas: Pa[]) {
  if (!pas.length) return null;
  return {
    n: pas.length,
    onBase: pas.filter((p) => ON.has(p.result)).length / pas.length,
    k: pas.filter((p) => K.has(p.result)).length / pas.length,
  };
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

/**
 * A player's recent plate appearances from live-scored games, with on-base and
 * strikeout rates vs the 20 before — game results feeding development.
 */
export async function RecentAtBats({
  playerId,
  gameHref,
}: {
  playerId: string;
  gameHref?: (gameId: string) => string;
}) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("game_plays")
    .select("result, seq, game:games!inner (id, date, opponent)")
    .eq("batter_id", playerId)
    .eq("kind", "pa")
    .order("created_at", { ascending: false })
    .limit(200);
  const pas: Pa[] = (data ?? [])
    .filter((r) => r.result && r.game)
    .map((r) => ({
      result: r.result as Result,
      gameId: r.game!.id,
      date: r.game!.date,
      opponent: r.game!.opponent,
      seq: r.seq,
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || b.seq - a.seq);
  if (pas.length === 0) return null;

  const last = rates(pas.slice(0, 20))!;
  const before = rates(pas.slice(20, 40));
  const games = [...new Map(pas.slice(0, 20).map((p) => [p.gameId, p])).values()].slice(0, 6);
  const trend = (now: number, then: number, goodUp: boolean) => {
    const d = now - then;
    if (Math.abs(d) < 0.05) return <span className="text-zinc-500"> (steady)</span>;
    const good = goodUp ? d > 0 : d < 0;
    return (
      <span className={good ? "text-brand-700" : "text-amber-700"}>
        {" "}
        ({d > 0 ? "▲" : "▼"} from {pct(then)})
      </span>
    );
  };

  return (
    <section
      className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-zinc-200"
      aria-label="Recent at-bats"
    >
      <div>
        <h2 className="font-semibold">Recent at-bats</h2>
        <p className="text-sm text-zinc-700">
          Last {last.n}: on base {pct(last.onBase)}
          {before && before.n >= 10 ? trend(last.onBase, before.onBase, true) : null} · struck out{" "}
          {pct(last.k)}
          {before && before.n >= 10 ? trend(last.k, before.k, false) : null}
        </p>
      </div>
      <ul className="space-y-2">
        {games.map((g) => (
          <li key={g.gameId} className="flex flex-wrap items-center gap-2 text-sm">
            <a
              href={gameHref ? gameHref(g.gameId) : undefined}
              className="w-28 shrink-0 truncate text-zinc-600 hover:underline"
            >
              {new Date(`${g.date}T12:00:00Z`).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                timeZone: "UTC",
              })}{" "}
              {g.opponent}
            </a>
            {pas
              .filter((p) => p.gameId === g.gameId)
              .reverse()
              .map((p, i) => (
                <span
                  key={i}
                  title={LONG[p.result]}
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-xs font-semibold",
                    HIT.has(p.result)
                      ? "bg-brand-100 text-brand-900"
                      : ON.has(p.result)
                        ? "bg-sky-100 text-sky-900"
                        : K.has(p.result)
                          ? "bg-rose-100 text-rose-900"
                          : "bg-zinc-100 text-zinc-700",
                  )}
                >
                  {LABEL[p.result]}
                </span>
              ))}
          </li>
        ))}
      </ul>
    </section>
  );
}
