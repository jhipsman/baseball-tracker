import Link from "next/link";
import { requireUser } from "@/lib/org";
import { playerToday } from "@/lib/player";
import { loadSeasonLines } from "@/lib/stats-data";
import {
  battingRates,
  eraLabel,
  fmtAvg,
  fmtRate,
  formatIP,
  pitchingRates,
  regulationInnings,
  sumBatting,
  sumPitching,
} from "@/lib/stats";

/**
 * A player's season at a glance: AVG/OBP/SLG/HR/RBI/SB, plus ERA/IP/SO/WHIP
 * if they pitched. Calendar-year season, scrimmages excluded. Server component.
 */
export async function PlayerSeasonLine({
  playerId,
  orgId,
  year,
  includeScrimmages = false,
  href,
}: {
  playerId: string;
  orgId: string;
  /** Defaults to the current year. */
  year?: number;
  includeScrimmages?: boolean;
  /** Optional "All stats →" link. */
  href?: string;
}) {
  const { supabase } = await requireUser();
  const y = year ?? Number((await playerToday()).today.slice(0, 4));
  const { games, batting, pitching } = await loadSeasonLines(supabase, orgId, {
    year: y,
    includeScrimmages,
    playerId,
  });

  const link = href ? (
    <Link href={href} className="text-sm font-medium text-brand-700 hover:underline">
      All stats →
    </Link>
  ) : null;

  if (games.length === 0) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-4 text-sm text-zinc-500 ring-1 ring-zinc-200">
        <span>No game stats in {y} yet.</span>
        {link}
      </div>
    );
  }

  const inn = regulationInnings(games);
  const b = batting.length ? sumBatting(batting) : null;
  const br = b ? battingRates(b) : null;
  const p = pitching.length ? sumPitching(pitching) : null;
  const pr = p ? pitchingRates(p, inn) : null;

  const stats: { label: string; value: string; title?: string }[] = [];
  if (b && br)
    stats.push(
      { label: "AVG", value: fmtAvg(br.avg), title: `${b.h}-for-${b.ab}` },
      { label: "OBP", value: fmtAvg(br.obp) },
      { label: "SLG", value: fmtAvg(br.slg) },
      { label: "HR", value: String(b.hr) },
      { label: "RBI", value: String(b.rbi) },
      { label: "SB", value: String(b.sb) },
    );
  if (p && pr)
    stats.push(
      { label: eraLabel(inn), value: fmtRate(pr.era) },
      { label: "IP", value: formatIP(p.outs) },
      { label: "SO", value: String(p.so) },
      { label: "WHIP", value: fmtRate(pr.whip) },
    );

  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs text-zinc-500">
          {y} season · {games.length} game{games.length === 1 ? "" : "s"}
          {b ? ` · ${b.h}-for-${b.ab}` : ""}
        </p>
        {link}
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-x-3 gap-y-2 sm:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} title={s.title}>
            <dt className="text-[11px] font-semibold tracking-wide text-zinc-500">{s.label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
