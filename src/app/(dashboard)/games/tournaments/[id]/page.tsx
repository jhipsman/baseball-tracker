import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { playerToday } from "@/lib/player";
import { formatRecord, loadGameFormOptions, loadTournament, recordOf } from "@/lib/games";
import { DirectionsLink, GameList, TournamentSummary } from "@/components/games/game-ui";
import {
  DeleteTournamentButton,
  EditTournamentForm,
  NewGameForm,
} from "@/components/games/game-forms";

export const metadata: Metadata = { title: "Tournament" };

export default async function TournamentPage({ params }: PageProps<"/games/tournaments/[id]">) {
  const { id } = await params;
  const { supabase, org, isStaff } = await requireActiveOrg();
  if (!isStaff) redirect("/player/games");
  const data = await loadTournament(supabase, id);
  if (!data || data.tournament.orgId !== org.id) notFound();
  const { tournament: t, games } = data;
  const { today } = await playerToday();
  const { groups, tournaments } = await loadGameFormOptions(supabase, org.id);
  const record = recordOf(games);
  const played = record.w + record.l + record.t;
  const nextDate = games.at(-1)?.date ?? t.startDate;

  return (
    <div className="max-w-4xl">
      <Link href="/games?view=tournaments" className="text-sm text-zinc-500 hover:text-zinc-800">
        ← Tournaments
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3 rounded-xl bg-surface p-4 ring-1 ring-zinc-200">
        <TournamentSummary t={t} />
        <div className="flex flex-col items-end gap-2">
          <p className="text-sm text-zinc-600">
            Record{" "}
            <span
              data-testid="tournament-record"
              className="font-semibold text-zinc-900 tabular-nums"
            >
              {played > 0 ? formatRecord(record) : "—"}
            </span>
          </p>
          <DirectionsLink address={t.address} location={t.location} />
        </div>
      </div>
      {t.notes ? (
        <p className="mt-3 rounded-xl bg-surface p-4 text-sm whitespace-pre-line text-zinc-700 ring-1 ring-zinc-200">
          {t.notes}
        </p>
      ) : null}

      <h2 className="mt-6 mb-2 font-semibold">Games</h2>
      <GameList
        games={games}
        hrefFor={(g) => `/games/${g.id}`}
        today={today}
        empty="No games yet. Add pool play below; add bracket games as they're set."
      />

      <section className="mt-4 rounded-xl bg-surface ring-1 ring-zinc-200">
        <h2 className="p-4 font-semibold">Add a pool or bracket game</h2>
        <div className="border-t border-zinc-100 p-4">
          <NewGameForm
            key={games.length}
            idPrefix="tg-"
            returnTo={`/games/tournaments/${t.id}`}
            groups={groups}
            tournaments={tournaments}
            submitLabel="Add tournament game"
            defaults={{
              date: nextDate,
              kind: "tournament",
              homeAway: "neutral",
              tournamentId: t.id,
              groupId: t.groupId,
              location: t.location,
              address: t.address,
              inningsScheduled: 7,
            }}
          />
        </div>
      </section>

      <details className="group mt-4 rounded-xl bg-surface ring-1 ring-zinc-200">
        <summary className="cursor-pointer p-4 font-semibold">Edit tournament</summary>
        <div className="space-y-4 border-t border-zinc-100 p-4">
          <EditTournamentForm
            id={t.id}
            groups={groups}
            defaults={{
              name: t.name,
              startDate: t.startDate,
              endDate: t.endDate,
              location: t.location,
              address: t.address,
              url: t.url,
              notes: t.notes,
              groupId: t.groupId,
            }}
          />
          <DeleteTournamentButton id={t.id} />
        </div>
      </details>
    </div>
  );
}
