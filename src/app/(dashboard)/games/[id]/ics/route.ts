import type { NextRequest } from "next/server";
import { requireActiveOrg } from "@/lib/org";
import { gameIcs, loadGame } from "@/lib/games";
import { hrefForRole } from "@/lib/notifications";
import { siteOrigin } from "@/lib/site";

/** A single-event .ics for any game the viewer can see (RLS decides). */
export async function GET(_request: NextRequest, ctx: RouteContext<"/games/[id]/ics">) {
  const { id } = await ctx.params;
  const { supabase, org, membership } = await requireActiveOrg();
  const game = await loadGame(supabase, id);
  if (!game || game.orgId !== org.id) {
    return new Response("Game not found", { status: 404 });
  }
  const url = `${await siteOrigin()}${hrefForRole(`/games/${game.id}`, membership.role)}`;
  const body = gameIcs(game, { teamName: org.name, url });
  const slug =
    `${game.date}-${game.opponent}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "game";
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
