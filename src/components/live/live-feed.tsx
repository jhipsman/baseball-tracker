import { createClient } from "@/lib/supabase/server";
import { describePlay, halfLabel } from "@/lib/live/engine";
import { loadPlayerNames, loadPlays, parseLiveState } from "@/lib/live/data";
import { cn } from "@/lib/utils";

const firstName = (n: string) => n.split(" ")[0];

/** Situation and play-by-play for a game scored live (all roles; RLS applies stats privacy). */
export async function LiveFeed({
  gameId,
  orgId,
  live,
  limit = 12,
}: {
  gameId: string;
  orgId: string;
  live: boolean;
  limit?: number;
}) {
  const supabase = await createClient();
  const [{ data: game }, plays, names] = await Promise.all([
    supabase.from("games").select("live_state").eq("id", gameId).maybeSingle(),
    loadPlays(supabase, gameId),
    loadPlayerNames(supabase, orgId),
  ]);
  const state = parseLiveState(game?.live_state ?? null);
  if (!state && plays.length === 0) return null;
  const name = (id: string | null) => (id ? firstName(names.get(id) ?? "Player") : "—");
  const s = state?.summary;
  const shown = plays
    .filter((p) => p.kind !== "sub" || p.slot || p.pitcherId)
    .slice(-limit)
    .reverse();

  return (
    <section
      className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-zinc-200"
      aria-label="Game log"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Game log</h2>
        {live && s ? (
          <p className="text-sm font-medium text-zinc-700">
            {halfLabel(s)} · {s.outs} out{s.outs === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>
      {live && s ? (
        <p className="rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-800">
          {s.weBat ? (
            <>
              Now batting: <strong>{name(s.batterId)}</strong>
            </>
          ) : (
            <>
              Pitching: <strong>{name(s.pitcherId)}</strong>
              {s.pitcherPitches ? ` · ${s.pitcherPitches} pitches` : ""}
              {s.balls || s.strikes ? ` · count ${s.balls}-${s.strikes}` : ""}
            </>
          )}
        </p>
      ) : null}
      {shown.length === 0 ? (
        <p className="text-sm text-zinc-500">No plays yet.</p>
      ) : (
        <ol className="space-y-1.5 text-sm">
          {shown.map((p) => (
            <li key={p.seq} className="flex gap-2">
              <span className="w-16 shrink-0 text-xs text-zinc-500">
                {p.half === "top" ? "Top" : "Bot"} {p.inning}
              </span>
              <span
                className={cn(
                  p.weBat ? "text-zinc-900" : "text-zinc-600",
                  p.runs > 0 && "font-semibold",
                )}
              >
                {describePlay(p, name)}
              </span>
            </li>
          ))}
        </ol>
      )}
      {plays.length > limit ? (
        <p className="text-xs text-zinc-500">Showing the last {limit} plays.</p>
      ) : null}
    </section>
  );
}
