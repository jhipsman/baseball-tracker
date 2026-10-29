import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { loadGame, matchupLabel } from "@/lib/games";
import { loadBirthDates } from "@/lib/throwing";
import { ageOn, pitchSmartBand } from "@/lib/workload";
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
    <div className="mb-4">
      <Link href={`/games/${id}`} className="text-sm text-brand-700 hover:underline">
        ← Game
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
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
    const defaultLineup = (recent?.[0]?.game_batting ?? [])
      .filter((r) => r.batting_order != null && names.has(r.player_id))
      .sort((a, b) => (a.batting_order ?? 99) - (b.batting_order ?? 99))
      .map((r) => r.player_id);
    return (
      <div className="max-w-2xl">
        {header}
        <p className="mb-4 text-sm text-zinc-600">
          Set the batting order and starting pitcher. Then tap the result of each at-bat; the box
          score, season stats, and Pitch Smart pitch counts fill in automatically. Parents can
          follow along live.
        </p>
        <LineupSetup
          gameId={id}
          roster={roster}
          defaultLineup={defaultLineup}
          defaultPitcher={null}
          defaultWeBatFirst={game.homeAway === "away"}
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

  return (
    <div className="max-w-2xl">
      {header}
      <Scorer
        gameId={id}
        final={game.status === "final"}
        inningLabel={halfLabel(s)}
        outs={s.outs}
        weBat={s.weBat}
        us={s.us}
        them={s.them}
        opponent={game.opponent}
        lineup={s.lineup.map(p)}
        batterIdx={s.batterIdx}
        pitcher={pitcherId ? p(pitcherId) : null}
        pitches={pitches}
        balls={live.balls}
        strikes={live.strikes}
        smart={status && band ? { ...status, ages: band.ages, dailyMax: band.dailyMax } : null}
        hasBirthdate={!!birth}
        roster={roster}
        feed={plays
          .slice(-10)
          .reverse()
          .map((pl) => ({
            seq: pl.seq,
            label: `${pl.half === "top" ? "Top" : "Bot"} ${pl.inning}`,
            text: describePlay(pl, name),
          }))}
      />
      {batterUp(s) === null && !pitcherId ? (
        <p className="mt-3 text-sm text-amber-800">Choose who&apos;s pitching to start logging.</p>
      ) : null}
    </div>
  );
}
