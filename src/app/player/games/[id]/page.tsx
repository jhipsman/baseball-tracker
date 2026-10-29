import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { loadGame } from "@/lib/games";
import { GameView } from "@/components/games/game-view";

export const metadata: Metadata = { title: "Game" };

export default async function PlayerGamePage({ params }: PageProps<"/player/games/[id]">) {
  const { id } = await params;
  const { supabase, org } = await requireActiveOrg();
  // RLS only returns team-wide games and the player's groups' games.
  const game = await loadGame(supabase, id);
  if (!game || game.orgId !== org.id) notFound();
  return <GameView game={game} teamName={org.name} backHref="/player/games" backLabel="Games" />;
}
