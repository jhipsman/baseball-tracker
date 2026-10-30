import {
  battingRates,
  fmtAvg,
  fmtRate,
  pitchingRates,
  qualifiers,
  type PlayerSeason,
} from "@/lib/stats";

type Names = Map<string, { name: string; short: string }>;
type Leader = { id: string; value: number; display: string };

function top(list: Leader[], lowFirst = false, k = 3) {
  return list
    .filter((l) => Number.isFinite(l.value))
    .sort((a, b) => (lowFirst ? a.value - b.value : b.value - a.value))
    .filter((l) => lowFirst || l.value > 0)
    .slice(0, k);
}

/** Leaders cards: AVG, HR, RBI, SB, ERA, SO (rate stats need enough PA / IP). */
export function Leaders({
  seasons,
  names,
  innings,
  teamGames,
}: {
  seasons: PlayerSeason[];
  names: Names;
  innings: number;
  teamGames: number;
}) {
  const q = qualifiers(teamGames);
  const bat = seasons.filter((s) => s.bat);
  const pit = seasons.filter((s) => s.pit);
  const count = (key: "hr" | "rbi" | "sb") =>
    top(bat.map((s) => ({ id: s.playerId, value: s.bat![key], display: String(s.bat![key]) })));

  const cards: { title: string; note?: string; list: Leader[] }[] = [
    {
      title: "AVG",
      note: `min ${q.minPA} PA`,
      list: top(
        bat
          .filter((s) => battingRates(s.bat!).pa >= q.minPA && s.bat!.ab > 0)
          .map((s) => {
            const a = battingRates(s.bat!).avg ?? 0;
            return { id: s.playerId, value: a, display: fmtAvg(a) };
          }),
      ),
    },
    { title: "HR", list: count("hr") },
    { title: "RBI", list: count("rbi") },
    { title: "SB", list: count("sb") },
    {
      title: `ERA`,
      note: `min ${Math.round(q.minOuts / 3)} IP · per ${innings} inn`,
      list: top(
        pit
          .filter((s) => s.pit!.outs >= q.minOuts && s.pit!.outs > 0)
          .map((s) => {
            const e = pitchingRates(s.pit!, innings).era ?? 0;
            return { id: s.playerId, value: e, display: fmtRate(e) };
          }),
        true,
      ),
    },
    {
      title: "SO",
      note: "pitching",
      list: top(pit.map((s) => ({ id: s.playerId, value: s.pit!.so, display: String(s.pit!.so) }))),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => (
        <section key={c.title} className="rounded-xl bg-surface p-3 ring-1 ring-zinc-200">
          <h3 className="flex items-baseline justify-between gap-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            {c.title}
            {c.note ? <span className="text-[10px] font-normal normal-case">{c.note}</span> : null}
          </h3>
          {c.list.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-400">—</p>
          ) : (
            <ol className="mt-1 space-y-0.5">
              {c.list.map((l, i) => (
                <li key={l.id} className="flex items-baseline justify-between gap-2 text-sm">
                  <span className={i === 0 ? "truncate font-semibold" : "truncate text-zinc-600"}>
                    {names.get(l.id)?.short ?? "Player"}
                  </span>
                  <span
                    className={
                      i === 0
                        ? "text-lg font-semibold text-zinc-900 tabular-nums"
                        : "text-zinc-600 tabular-nums"
                    }
                  >
                    {l.display}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      ))}
    </div>
  );
}
