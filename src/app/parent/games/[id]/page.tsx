import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pickChild, requireParent } from "@/lib/parent";
import { loadGame, loadPlayerGroupIds } from "@/lib/games";
import { GameView } from "@/components/games/game-view";
import { NoLinkedPlayer, withPlayer } from "../../parent-ui";

export const metadata: Metadata = { title: "Game" };

export default async function ParentGamePage({
  params,
  searchParams,
}: PageProps<"/parent/games/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const { supabase, org, children: kids } = await requireParent();
  const child = pickChild(kids, sp.player);
  if (!child) return <NoLinkedPlayer />;
  // RLS returns team-wide games and games for a linked child's groups.
  const game = await loadGame(supabase, id);
  if (!game || game.orgId !== org.id) notFound();
  if (game.groupId) {
    // A group-only game must be for one of this parent's players.
    const groups = await Promise.all(kids.map((k) => loadPlayerGroupIds(supabase, k.id)));
    if (!groups.some((s) => s.has(game.groupId!))) notFound();
  }
  return (
    <GameView
      game={game}
      teamName={org.name}
      backHref={withPlayer("/parent/games", kids, child)}
      backLabel="Games"
    />
  );
}
