import { FIELD_POSITIONS, opponentLabel, opponentOrder } from "@/lib/live/defense";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { loadGame, matchupLabel } from "@/lib/games";
import { loadBirthDates, loadThrowing } from "@/lib/throwing";
import { addDays } from "@/lib/schedule";
import { ageOn, availability, pitchSmartBand, throwingAlerts } from "@/lib/workload";
import { formatGameDate } from "@/lib/games";
import type { PitcherOption } from "@/components/live/lineup-setup";
import {
  batterUp,
  describePlay,
  halfLabel,
  pitchCount,
  pitchSmartLive,
  situation,
} from "@/lib/live/engine";
import { loadPlayerNames, loadPlays, parseLiveState } from "@/lib/live/data";
import { LineupSetup } from "@/components/live/lineup-setup";
import { Scorer } from "@/components/live/scorer";

export const metadata: Metadata = { title: "Live scoring" };

export default async function LiveScoringPage({ params }: PageProps<"/games/[id]/live">) {
  const { id } = await params;
  const { supabase, org, isStaff } = await requireActiveOrg();
  if (!isStaff) redirect(`/player/games/${id}`);
  const game = await loadGame(supabase, id);
  if (!game || game.orgId !== org.id) notFound();

  const [{ data: row }, plays, names, births] = await Promise.all([
    supabase.from("games").select("live_state").eq("id", id).single(),
    loadPlays(supabase, id),
    loadPlayerNames(supabase, org.id),
    loadBirthDates(supabase, org.id),
  ]);
  const live = parseLiveState(row?.live_state ?? null);
  const roster = [...names.entries()]
    .map(([pid, name]) => ({ id: pid, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const p = (pid: string) => ({ id: pid, name: names.get(pid) ?? "Player" });

  const header = (
    <div className="mb-3 sm:mb-4">
      <Link
        href={`/games/${id}`}
        className="inline-flex min-h-11 items-center text-sm text-brand-700 hover:underline sm:min-h-0"
      >
        ← Game
      </Link>
      <h1 className="text-xl font-medium tracking-tight sm:text-3xl">
        Live: {matchupLabel(game.homeAway, game.opponent)}
      </h1>
    </div>
  );

  if (!live) {
    // Default lineup: the batting order from the most recent game with a box score.
    const { data: recent } = await supabase
      .from("games")
      .select("id, game_batting!inner (player_id, batting_order)")
      .eq("org_id", org.id)
      .neq("id", id)
      .order("date", { ascending: false })
      .limit(1);
    // Who can pitch today: Player Health status for every player, pitchers first.
    const [{ data: positions }, throws] = await Promise.all([
      supabase
        .from("org_memberships")
        .select("profile_id, position")
        .eq("org_id", org.id)
        .eq("role", "player"),
      loadThrowing(supabase, org.id, addDays(game.date, -30)),
    ]);
    const posOf = new Map((positions ?? []).map((m) => [m.profile_id, m.position]));
    const RANK = { ready: 0, unknown: 1, rest: 2, pain: 3 } as const;
    const pitcherOptions: PitcherOption[] = roster
      .map((pl) => {
        const mine = throws.filter((r) => r.playerId === pl.id);
        const birth = births.get(pl.id) ?? null;
        const a = availability(mine, birth, game.date);
        const pain = throwingAlerts(mine, birth, game.date).some((x) => x.level === "critical");
        const option: PitcherOption = {
          ...pl,
          isPitcher: posOf.get(pl.id) === "P",
          status: pain
            ? "pain"
            : a.state === "resting"
              ? "rest"
              : a.state === "available"
                ? "ready"
                : "unknown",
          detail: pain
            ? "Reported arm pain"
            : a.state === "resting"
              ? `Rest until ${formatGameDate(a.until)}`
              : a.state === "available"
                ? `Ready · up to ${a.remainingToday} pitches`
                : "Ready · add a birthday for pitch limits",
        };
        return option;
      })
      .sort(
        (x, y) =>
          Number(y.isPitcher) - Number(x.isPitcher) ||
          RANK[x.status] - RANK[y.status] ||
          x.name.localeCompare(y.name),
      );
    const defaultLineup = (recent?.[0]?.game_batting ?? [])
      .filter((r) => r.batting_order != null && names.has(r.player_id))
      .sort((a, b) => (a.batting_order ?? 99) - (b.batting_order ?? 99))
      .map((r) => r.player_id);
    return (
      <div className="max-w-2xl">
        {header}
        <p className="mb-4 text-sm text-zinc-600">
          A few quick steps, then tap each pitch and play from the dugout.
        </p>
        <LineupSetup
          gameId={id}
          roster={roster}
          defaultLineup={defaultLineup}
          pitchers={pitcherOptions}
          homeAway={game.homeAway}
          positions={Object.fromEntries(
            [...posOf].flatMap(([pid, pos]) => (pos ? [[pid, pos]] : [])),
          )}
        />
      </div>
    );
  }

  const s = situation(live, plays);
  const pitcherId = s.pitcherId;
  const pitches = pitcherId ? pitchCount(live, plays, pitcherId) : 0;
  const birth = pitcherId ? (births.get(pitcherId) ?? null) : null;
  const band = birth ? pitchSmartBand(ageOn(birth, game.date)) : null;
  const status = pitchSmartLive(pitches, band);
  const name = (pid: string | null) => (pid ? (names.get(pid) ?? "Player").split(" ")[0] : "—");
  const opp = opponentOrder(live, plays);
  // The mound follows pitching changes; everyone else stays where the coach put them.
  const defense = { ...(live.defense ?? {}), ...(pitcherId ? { P: pitcherId } : {}) };
  for (const pos of FIELD_POSITIONS)
    if (pos !== "P" && defense[pos] === pitcherId) delete defense[pos];

  return (
    // data-focus: on phones the app menu steps aside while scoring (see globals.css).
    <div className="max-w-6xl" data-focus={game.status === "final" ? undefined : ""}>
      {header}
      <Scorer
        gameId={id}
        final={game.status === "final"}
        inningLabel={halfLabel(s)}
        outs={s.outs}
        weBat={s.weBat}
        us={s.us}
        them={s.them}
        teamName={org.name}
        weBatFirst={live.weBatFirst}
        bases={s.bases}
        basesKnown={s.basesKnown}
        lastSeq={plays.at(-1)?.seq ?? 0}
        lineScore={s.lineScore}
        opponent={game.opponent}
        lineup={s.lineup.map(p)}
        batterIdx={s.batterIdx}
        pitcher={pitcherId ? p(pitcherId) : null}
        pitches={pitches}
        atBatPitches={live.pitches}
        balls={live.balls}
        strikes={live.strikes}
        smart={status && band ? { ...status, ages: band.ages, dailyMax: band.dailyMax } : null}
        hasBirthdate={!!birth}
        roster={roster}
        defense={defense}
        oppLineup={Array.from({ length: opp.size }, (_, i) => live.oppLineup?.[i] ?? "")}
        oppNext={opp.next}
        feed={plays
          .slice(-10)
          .reverse()
          .map((pl) => ({
            seq: pl.seq,
            label: `${pl.half === "top" ? "Top" : "Bot"} ${pl.inning}`,
            text: describePlay(
              pl,
              name,
              opp.slots.has(pl.seq) ? opponentLabel(live, opp.slots.get(pl.seq)!) : undefined,
            ),
          }))}
      />
      {batterUp(s) === null && !pitcherId ? (
        <p className="mt-3 text-sm text-amber-800">Choose who&apos;s pitching to start logging.</p>
      ) : null}
    </div>
  );
}
