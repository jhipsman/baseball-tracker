import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { loadGameLines } from "@/lib/stats-data";
import { boxName } from "@/lib/stats";
import { ageOn } from "@/lib/workload";
import { BoxScoreForm, type RosterPlayer } from "./box-score-form";

export const metadata: Metadata = { title: "Box score" };

const fmtDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

export default async function BoxScoreEntryPage({ params }: PageProps<"/games/[id]/stats">) {
  const { id } = await params;
  const { supabase, org, isStaff, membership } = await requireActiveOrg();
  if (!isStaff)
    redirect(membership.role === "parent" ? `/parent/games/${id}` : `/player/games/${id}`);

  const { game, batting, pitching } = await loadGameLines(supabase, id).catch(() => ({
    game: null,
    batting: [],
    pitching: [],
  }));
  if (!game || game.orgId !== org.id) notFound();

  const [{ data: members }, { data: groupMembers }, { data: throws }] = await Promise.all([
    supabase
      .from("org_memberships")
      .select(
        "profile_id, position, jersey_number, status, profile:profiles (full_name, email, birth_date)",
      )
      .eq("org_id", org.id)
      .eq("role", "player"),
    game.groupId
      ? supabase.from("player_group_members").select("profile_id").eq("group_id", game.groupId)
      : Promise.resolve({ data: null }),
    supabase
      .from("throwing_logs")
      .select("player_id, throwing_type, pitch_count, game_id")
      .eq("org_id", org.id)
      .eq("date", game.date)
      .in("throwing_type", ["game", "live_abs"]),
  ]);

  const inGroup = groupMembers ? new Set(groupMembers.map((g) => g.profile_id)) : null;
  const onLineup = new Set([...batting, ...pitching].map((l) => l.playerId));
  const roster: RosterPlayer[] = (members ?? [])
    .filter(
      (m) =>
        onLineup.has(m.profile_id) ||
        (m.status !== "inactive" && (!inGroup || inGroup.has(m.profile_id))),
    )
    .map((m) => {
      const mine = (throws ?? []).filter((t) => t.player_id === m.profile_id && t.game_id !== id);
      const manual = mine.find((t) => t.throwing_type === "game" && t.game_id == null);
      return {
        id: m.profile_id,
        name: m.profile.full_name || m.profile.email,
        short: boxName(m.profile.full_name, m.profile.email),
        jersey: m.jersey_number,
        position: m.position && m.position !== "UTIL" && m.position !== "OF" ? m.position : null,
        age: m.profile.birth_date ? ageOn(m.profile.birth_date, game.date) : null,
        otherPitches: mine.reduce((n, t) => n + t.pitch_count, 0),
        manualGameLog: manual ? manual.pitch_count : null,
      };
    })
    .sort((a, b) => (a.jersey ?? 999) - (b.jersey ?? 999) || a.name.localeCompare(b.name));

  const score =
    game.teamScore != null && game.opponentScore != null
      ? `${game.teamScore > game.opponentScore ? "W" : game.teamScore < game.opponentScore ? "L" : "T"} ${game.teamScore}–${game.opponentScore}`
      : null;

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <Link
          href={`/games/${id}`}
          className="text-xs font-medium text-zinc-500 hover:text-zinc-800"
        >
          ← Back to game
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Box score: {game.homeAway === "away" ? "@" : "vs"} {game.opponent}
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          {fmtDate(game.date)}
          {score ? ` · ${score}` : " · no final score yet"}
          {game.kind === "scrimmage" ? " · scrimmage (left out of season stats by default)" : ""}
        </p>
      </div>

      {roster.length === 0 ? (
        <p className="rounded-xl bg-white p-6 text-sm text-zinc-500 ring-1 ring-zinc-200">
          No players on the roster yet.{" "}
          <Link href="/roster" className="font-semibold text-brand-700">
            Invite players
          </Link>{" "}
          to enter stats.
        </p>
      ) : (
        <BoxScoreForm
          gameId={id}
          teamScore={game.teamScore}
          opponentScore={game.opponentScore}
          roster={roster}
          initialBatting={batting}
          initialPitching={pitching}
        />
      )}
    </div>
  );
}
