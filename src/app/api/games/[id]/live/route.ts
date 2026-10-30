import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadLiveSnapshot } from "@/lib/live/data";

/** Current live-game snapshot for the signed-in viewer (database rules decide what they see). */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/games/[id]/live">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const snapshot = await loadLiveSnapshot(supabase, id);
  if (!snapshot) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
}
