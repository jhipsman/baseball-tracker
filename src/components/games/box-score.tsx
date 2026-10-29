import Link from "next/link";
import { loadGameLines, loadPlayerNames, statsViewer } from "@/lib/stats-data";
import { boxFootnotes, formatIP, sumBatting, sumPitching } from "@/lib/stats";
import { cn } from "@/lib/utils";

const th = "px-1.5 py-1.5 text-right font-medium";
const td = "px-1.5 py-1.5 text-right";

/**
 * Newspaper-style box score for a game. Server component; what's shown follows
 * RLS (in "each family sees their own" mode players and parents only get
 * their own player's lines). Staff get an enter/edit link.
 */
export async function BoxScore({ gameId }: { gameId: string }) {
  const { supabase, org, isStaff, limited, membership } = await statsViewer();
  const seasonHref =
    membership.role === "parent"
      ? "/parent/stats"
      : membership.role === "player"
        ? "/player/stats"
        : null;
  const { game, batting, pitching } = await loadGameLines(supabase, gameId);
  if (!game || game.orgId !== org.id) return null;

  const enterHref = `/games/${gameId}/stats`;
  if (batting.length === 0 && pitching.length === 0) {
    return (
      <section
        aria-label="Box score"
        className="rounded-xl bg-white p-4 text-sm ring-1 ring-zinc-200"
      >
        <h2 className="font-semibold">Box score</h2>
        <p className="mt-1 text-zinc-500">
          {isStaff
            ? "No stats entered for this game yet."
            : limited
              ? "No stats for your player in this game."
              : "No box score yet."}
        </p>
        {isStaff ? (
          <Link
            href={enterHref}
            className="mt-3 inline-flex h-10 items-center rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-600"
          >
            Enter box score
          </Link>
        ) : null}
      </section>
    );
  }

  const names = await loadPlayerNames(
    supabase,
    org.id,
    [...batting, ...pitching].map((l) => l.playerId),
  );
  const nm = (id: string) => names.get(id)?.short ?? "Player";
  const bt = sumBatting(batting);
  const pt = sumPitching(pitching);
  const notes = boxFootnotes(batting.map((b) => ({ ...b, name: nm(b.playerId) })));
  const pitchCounts = pitching.filter((p) => p.pitches != null);
  const showTotals = !limited;

  return (
    <section
      aria-label="Box score"
      className="space-y-3 rounded-xl bg-white p-3 ring-1 ring-zinc-200 sm:p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Box score</h2>
        {isStaff ? (
          <Link href={enterHref} className="text-sm font-medium text-brand-700 hover:underline">
            Edit box score →
          </Link>
        ) : seasonHref ? (
          <Link href={seasonHref} className="text-sm font-medium text-brand-700 hover:underline">
            Season stats →
          </Link>
        ) : null}
      </div>
      {limited ? (
        <p className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
          Your team shares game stats with each family only, so you see just your player&apos;s
          lines.
        </p>
      ) : null}

      {batting.length ? (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <caption className="sr-only">Batting</caption>
            <thead>
              <tr className="border-b border-zinc-200 text-xs text-zinc-500">
                <th className="px-1 py-1.5 text-left font-medium">Batting</th>
                <th className={th}>AB</th>
                <th className={th}>R</th>
                <th className={th}>H</th>
                <th className={th}>RBI</th>
                <th className={th}>BB</th>
                <th className={th}>SO</th>
              </tr>
            </thead>
            <tbody>
              {batting.map((b) => (
                <tr key={b.playerId} className="border-b border-zinc-100">
                  <th scope="row" className="max-w-44 truncate px-1 py-1.5 text-left font-normal">
                    {b.battingOrder != null ? (
                      <span className="mr-1.5 inline-block w-4 text-right text-xs text-zinc-400">
                        {b.battingOrder}
                      </span>
                    ) : null}
                    <span className="font-medium">{nm(b.playerId)}</span>
                    {b.position ? (
                      <span className="ml-1 text-xs text-zinc-500">{b.position}</span>
                    ) : null}
                  </th>
                  <td className={td}>{b.ab}</td>
                  <td className={td}>{b.r}</td>
                  <td className={td}>{b.h}</td>
                  <td className={td}>{b.rbi}</td>
                  <td className={td}>{b.bb}</td>
                  <td className={td}>{b.so}</td>
                </tr>
              ))}
            </tbody>
            {showTotals ? (
              <tfoot>
                <tr className="font-semibold">
                  <th scope="row" className="px-1 py-1.5 text-left">
                    Totals
                  </th>
                  <td className={td}>{bt.ab}</td>
                  <td className={td}>{bt.r}</td>
                  <td className={td}>{bt.h}</td>
                  <td className={td}>{bt.rbi}</td>
                  <td className={td}>{bt.bb}</td>
                  <td className={td}>{bt.so}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      ) : null}
      {notes.length ? (
        <p className="text-xs leading-relaxed text-zinc-600">
          {notes.map((n) => (
            <span key={n.label} className="mr-2">
              <span className="font-semibold">{n.label}:</span> {n.text}.
            </span>
          ))}
        </p>
      ) : null}

      {pitching.length ? (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <caption className="sr-only">Pitching</caption>
            <thead>
              <tr className="border-b border-zinc-200 text-xs text-zinc-500">
                <th className="px-1 py-1.5 text-left font-medium">Pitching</th>
                <th className={th}>IP</th>
                <th className={th}>H</th>
                <th className={th}>R</th>
                <th className={th}>ER</th>
                <th className={th}>BB</th>
                <th className={th}>SO</th>
              </tr>
            </thead>
            <tbody>
              {pitching.map((p) => (
                <tr key={p.playerId} className="border-b border-zinc-100">
                  <th scope="row" className="max-w-44 truncate px-1 py-1.5 text-left font-medium">
                    {nm(p.playerId)}
                    {p.decision ? (
                      <span
                        className={cn(
                          "ml-1.5 rounded px-1 text-xs font-semibold",
                          p.decision === "W" || p.decision === "S"
                            ? "bg-brand-50 text-brand-900"
                            : p.decision === "L"
                              ? "bg-zinc-100 text-zinc-700"
                              : "bg-zinc-100 text-zinc-600",
                        )}
                      >
                        {p.decision}
                      </span>
                    ) : null}
                  </th>
                  <td className={td}>{formatIP(p.outs)}</td>
                  <td className={td}>{p.h}</td>
                  <td className={td}>{p.r}</td>
                  <td className={td}>{p.er}</td>
                  <td className={td}>{p.bb}</td>
                  <td className={td}>{p.so}</td>
                </tr>
              ))}
            </tbody>
            {showTotals && pitching.length > 1 ? (
              <tfoot>
                <tr className="font-semibold">
                  <th scope="row" className="px-1 py-1.5 text-left">
                    Totals
                  </th>
                  <td className={td}>{formatIP(pt.outs)}</td>
                  <td className={td}>{pt.h}</td>
                  <td className={td}>{pt.r}</td>
                  <td className={td}>{pt.er}</td>
                  <td className={td}>{pt.bb}</td>
                  <td className={td}>{pt.so}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      ) : null}
      {pitchCounts.length ? (
        <p className="text-xs leading-relaxed text-zinc-600">
          <span className="font-semibold">Pitches–strikes:</span>{" "}
          {pitchCounts
            .map((p) => `${nm(p.playerId)} ${p.pitches}${p.strikes != null ? `–${p.strikes}` : ""}`)
            .join(", ")}
          .
          {pitching.some((p) => p.hbp > 0) ? (
            <>
              {" "}
              <span className="font-semibold">HBP:</span>{" "}
              {pitching
                .filter((p) => p.hbp > 0)
                .map((p) => (p.hbp > 1 ? `${nm(p.playerId)} ${p.hbp}` : nm(p.playerId)))
                .join(", ")}
              .
            </>
          ) : null}
          {pitching.some((p) => p.hr > 0) ? (
            <>
              {" "}
              <span className="font-semibold">HR allowed:</span>{" "}
              {pitching
                .filter((p) => p.hr > 0)
                .map((p) => (p.hr > 1 ? `${nm(p.playerId)} ${p.hr}` : nm(p.playerId)))
                .join(", ")}
              .
            </>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}
