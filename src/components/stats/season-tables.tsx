import {
  battingRates,
  eraLabel,
  fmtAvg,
  fmtRate,
  formatIP,
  pitchingRates,
  qualifiers,
  sumBatting,
  combinePitching,
  type BattingTotals,
  type PitchingTotals,
  type PlayerSeason,
} from "@/lib/stats";
import { SortableTable, type Cell, type Column, type Row } from "./sortable-table";

type Names = Map<string, { name: string; jersey: number | null }>;

const n = (v: number): Cell => ({ v, d: String(v) });
const avg = (v: number | null): Cell => ({ v, d: fmtAvg(v) });
const rate = (v: number | null, digits = 2): Cell => ({
  v: v == null ? null : Number.isFinite(v) ? v : 1e9,
  d: fmtRate(v, digits),
});

const BAT_COLS: Column[] = [
  { key: "g", label: "G", title: "Games" },
  { key: "pa", label: "PA", title: "Plate appearances" },
  { key: "ab", label: "AB", title: "At-bats" },
  { key: "r", label: "R", title: "Runs" },
  { key: "h", label: "H", title: "Hits" },
  { key: "doubles", label: "2B", title: "Doubles" },
  { key: "triples", label: "3B", title: "Triples" },
  { key: "hr", label: "HR", title: "Home runs" },
  { key: "rbi", label: "RBI", title: "Runs batted in" },
  { key: "bb", label: "BB", title: "Walks" },
  { key: "so", label: "SO", title: "Strikeouts" },
  { key: "hbp", label: "HBP", title: "Hit by pitch" },
  { key: "sb", label: "SB", title: "Stolen bases" },
  { key: "avg", label: "AVG", title: "Batting average (H / AB)" },
  { key: "obp", label: "OBP", title: "On-base % ((H+BB+HBP) / (AB+BB+HBP+SF))" },
  { key: "slg", label: "SLG", title: "Slugging (total bases / AB)" },
  { key: "ops", label: "OPS", title: "OBP + SLG" },
];
const BAT_RATES = ["avg", "obp", "slg", "ops"];

function batCells(t: BattingTotals): Record<string, Cell> {
  const r = battingRates(t);
  return {
    g: n(t.g),
    pa: n(r.pa),
    ab: n(t.ab),
    r: n(t.r),
    h: n(t.h),
    doubles: n(t.doubles),
    triples: n(t.triples),
    hr: n(t.hr),
    rbi: n(t.rbi),
    bb: n(t.bb),
    so: n(t.so),
    hbp: n(t.hbp),
    sb: n(t.sb),
    avg: avg(r.avg),
    obp: avg(r.obp),
    slg: avg(r.slg),
    ops: avg(r.ops),
  };
}

const pitCols = (inn: number): Column[] => [
  { key: "app", label: "APP", title: "Appearances" },
  { key: "ip", label: "IP", title: "Innings pitched" },
  { key: "w", label: "W", title: "Wins" },
  { key: "l", label: "L", title: "Losses" },
  { key: "sv", label: "SV", title: "Saves" },
  { key: "h", label: "H", title: "Hits allowed", lowFirst: true },
  { key: "r", label: "R", title: "Runs allowed", lowFirst: true },
  { key: "er", label: "ER", title: "Earned runs", lowFirst: true },
  { key: "bb", label: "BB", title: "Walks", lowFirst: true },
  { key: "so", label: "SO", title: "Strikeouts" },
  { key: "era", label: eraLabel(inn), title: `Earned runs per ${inn} innings`, lowFirst: true },
  { key: "whip", label: "WHIP", title: "Walks + hits per inning", lowFirst: true },
  { key: "kn", label: `K/${inn}`, title: `Strikeouts per ${inn} innings` },
  { key: "p", label: "P", title: "Pitches" },
];
const PIT_RATES = ["era", "whip", "kn"];

function pitCells(t: PitchingTotals, inn: number): Record<string, Cell> {
  const r = pitchingRates(t, inn);
  return {
    app: n(t.app),
    ip: { v: t.outs, d: formatIP(t.outs) },
    w: n(t.w),
    l: n(t.l),
    sv: n(t.sv),
    h: n(t.h),
    r: n(t.r),
    er: n(t.er),
    bb: n(t.bb),
    so: n(t.so),
    era: rate(r.era),
    whip: rate(r.whip),
    kn: rate(r.kPerN, 1),
    p: t.pitchedCounted ? n(t.pitches) : { v: null, d: "—" },
  };
}

const label = (names: Names, id: string) => {
  const p = names.get(id);
  if (!p) return "Player";
  return p.jersey != null ? `#${p.jersey} ${p.name}` : p.name;
};

/** Team batting and pitching tables for a season. */
export function SeasonTables({
  seasons,
  names,
  innings,
  teamGames,
  hrefFor,
  highlightId,
  showTotals = true,
}: {
  seasons: PlayerSeason[];
  names: Names;
  innings: number;
  teamGames: number;
  hrefFor?: (playerId: string) => string;
  highlightId?: string;
  showTotals?: boolean;
}) {
  const q = qualifiers(teamGames);
  const batters = seasons.filter((s) => s.bat);
  const pitchers = seasons.filter((s) => s.pit);

  const batRows: Row[] = batters.map((s) => ({
    id: s.playerId,
    name: label(names, s.playerId),
    href: hrefFor?.(s.playerId),
    highlight: s.playerId === highlightId,
    dim: battingRates(s.bat!).pa < q.minPA,
    cells: batCells(s.bat!),
  }));
  const pitRows: Row[] = pitchers.map((s) => ({
    id: s.playerId,
    name: label(names, s.playerId),
    href: hrefFor?.(s.playerId),
    highlight: s.playerId === highlightId,
    dim: s.pit!.outs < q.minOuts,
    cells: pitCells(s.pit!, innings),
  }));

  // Team totals: games are team games, not the sum of player games.
  const batTotal = sumBatting(batters.map((s) => s.bat!));
  const pitTotal = combinePitching(pitchers.map((s) => s.pit!));
  const batTotals = Object.fromEntries(
    Object.entries(batCells({ ...batTotal, g: teamGames })).map(([k, c]) => [k, c.d]),
  );
  const pitTotals = Object.fromEntries(
    Object.entries(pitCells(pitTotal, innings)).map(([k, c]) => [k, c.d]),
  );
  pitTotals.app = "";

  return (
    <div className="space-y-4">
      {batRows.length ? (
        <SortableTable
          caption="Batting"
          columns={BAT_COLS}
          rows={batRows}
          totals={showTotals ? batTotals : undefined}
          defaultSort="avg"
          dimKeys={BAT_RATES}
          note={
            <>
              Gray averages: fewer than {q.minPA} plate appearances (2 per team game), so not ranked
              among the leaders. Tap a column to sort.
            </>
          }
        />
      ) : null}
      {pitRows.length ? (
        <SortableTable
          caption="Pitching"
          columns={pitCols(innings)}
          rows={pitRows}
          totals={showTotals ? pitTotals : undefined}
          defaultSort="ip"
          dimKeys={PIT_RATES}
          note={
            <>
              ERA and K are per {innings} innings (the usual game length here). Gray rates: fewer
              than {formatIP(q.minOuts)} innings pitched (1 per team game).
            </>
          }
        />
      ) : null}
    </div>
  );
}
