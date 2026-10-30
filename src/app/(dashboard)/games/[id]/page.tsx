import type { Metadata } from "next";
import Link from "next/link";
import { BoxScore } from "@/components/games/box-score";
import { notFound, redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { playerToday } from "@/lib/player";
import { addDays } from "@/lib/schedule";
import {
  formatGameDate,
  HOME_AWAY_LABEL,
  KIND_LABEL,
  loadGame,
  loadGameFormOptions,
  matchupLabel,
} from "@/lib/games";
import {
  CalendarFileLink,
  DirectionsLink,
  OffBanner,
  StatusBadge,
  timeLine,
} from "@/components/games/game-ui";
import {
  DeleteGameButton,
  DuplicateGameForm,
  EditGameForm,
  StatusControls,
} from "@/components/games/game-forms";
import { LiveScoring } from "@/components/games/live-scoring";
import { LiveFeed } from "@/components/live/live-feed";

export const metadata: Metadata = { title: "Game" };

export default async function GamePage({ params }: PageProps<"/games/[id]">) {
  const { id } = await params;
  const { supabase, org, isStaff } = await requireActiveOrg();
  if (!isStaff) redirect(`/player/games/${id}`);
  const game = await loadGame(supabase, id);
  if (!game || game.orgId !== org.id) notFound();
  const { today } = await playerToday();
  const { groups, tournaments } = await loadGameFormOptions(supabase, org.id);
  const { data: liveRow } = await supabase.from("games").select("live_state").eq("id", id).single();
  const liveLogged = !!liveRow?.live_state;
  const g = game;

  const defaults = {
    opponent: g.opponent,
    date: g.date,
    startTime: g.startTime,
    arrivalTime: g.arrivalTime,
    homeAway: g.homeAway,
    kind: g.kind,
    groupId: g.groupId,
    tournamentId: g.tournamentId,
    location: g.location,
    address: g.address,
    notes: g.notes,
    inningsScheduled: g.inningsScheduled,
  };

  const atBatLink = (
    <Link
      href={`/games/${g.id}/live`}
      className="block rounded-xl bg-surface px-4 py-3 text-sm ring-1 ring-zinc-300 hover:bg-zinc-50"
    >
      <span className="font-semibold text-brand-700">Score at-bat by at-bat →</span>
      <span className="block text-zinc-600">
        Live pitch counts with Pitch Smart warnings, and the box score fills itself in.
      </span>
    </Link>
  );

  return (
    <div className="max-w-5xl">
      <Link
        href={g.tournamentId ? `/games/tournaments/${g.tournamentId}` : "/games"}
        className="text-sm text-zinc-500 hover:text-zinc-800"
      >
        ← {g.tournamentName ?? "Games"}
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
              {matchupLabel(g.homeAway, g.opponent)}
            </h1>
            <StatusBadge status={g.status} />
          </div>
          <p className="mt-1 text-sm text-zinc-600">
            {[
              formatGameDate(g.date, { weekday: "long", month: "long" }),
              timeLine(g),
              HOME_AWAY_LABEL[g.homeAway],
              KIND_LABEL[g.kind],
              g.groupName ? `${g.groupName} only` : "Whole team",
            ].join(" · ")}
          </p>
          {g.location || g.address ? (
            <p className="text-sm text-zinc-600">
              {[g.location, g.address].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <DirectionsLink address={g.address} location={g.location} />
          <CalendarFileLink id={g.id} />
        </div>
      </div>

      <div className="mt-5 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-x-6">
        <div className="space-y-4">
          <OffBanner status={g.status} />
          {liveLogged ? (
            <Link
              href={`/games/${g.id}/live`}
              className="flex items-center justify-between hero rounded-xl px-4 py-3"
            >
              <span className="font-semibold">
                {g.status === "final" ? "Open the game log" : "Open live scorer"}
              </span>
              <span aria-hidden>→</span>
            </Link>
          ) : (
            <LiveScoring
              key={g.status}
              id={g.id}
              status={g.status}
              opponent={g.opponent}
              teamName={org.name}
              lineScore={g.lineScore}
              currentInning={g.currentInning}
              inningsScheduled={g.inningsScheduled}
              teamScore={g.teamScore}
              opponentScore={g.opponentScore}
              alternative={atBatLink}
            />
          )}
          {!liveLogged && g.status === "live" ? atBatLink : null}
          <LiveFeed gameId={g.id} orgId={org.id} live={g.status === "live"} />
          <BoxScore gameId={g.id} />

          {g.notes ? (
            <section className="rounded-xl bg-surface p-4 ring-1 ring-zinc-200">
              <h2 className="font-semibold">Notes</h2>
              <p className="mt-1 text-sm whitespace-pre-line text-zinc-700">{g.notes}</p>
            </section>
          ) : null}
        </div>

        <div className="space-y-4">
          {g.status !== "final" && g.status !== "live" ? (
            <section className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-zinc-200">
              <h2 className="font-semibold">Schedule changes</h2>
              <p className="text-xs text-zinc-600">
                Postponing, canceling, or moving a game notifies{" "}
                {g.groupName ? `players & parents in ${g.groupName}` : "the whole team"}.
              </p>
              <StatusControls key={g.status} id={g.id} status={g.status} defaults={defaults} />
            </section>
          ) : null}

          <details className="group rounded-xl bg-surface ring-1 ring-zinc-200">
            <summary className="flex cursor-pointer items-center justify-between gap-2 p-4 font-semibold">
              Edit game
              <span className="text-xs font-normal text-zinc-500 group-open:hidden">
                Opponent, time, place, notes
              </span>
            </summary>
            <div className="border-t border-zinc-100 p-4">
              <EditGameForm
                id={g.id}
                defaults={defaults}
                groups={groups}
                tournaments={tournaments}
              />
            </div>
          </details>

          <section className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-zinc-200">
            <p className="font-semibold">More</p>
            <DuplicateGameForm
              id={g.id}
              defaultDate={g.date >= today ? addDays(g.date, 7) : today}
            />
            <DeleteGameButton id={g.id} />
          </section>
        </div>
      </div>
    </div>
  );
}
