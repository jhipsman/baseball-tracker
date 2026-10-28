import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { getMemberships, requireUser, setActiveOrgCookie } from "@/lib/org";
import { homeFor, hrefForRole } from "@/lib/notifications";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Opens a notification: marks it read, switches to its team, and goes to the role's page. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/n/[id]">) {
  const { id } = await ctx.params;
  const { supabase, user } = await requireUser();
  if (!UUID.test(id)) redirect("/notifications");

  const { data: n } = await supabase
    .from("notifications")
    .select("href, org_id, read_at")
    .eq("id", id)
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!n) redirect("/notifications");
  if (!n.read_at) {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("profile_id", user.id);
  }

  const memberships = await getMemberships();
  const membership = memberships.find((m) => m.org.id === n.org_id);
  if (!membership) redirect(homeFor(memberships[0]?.role ?? "player"));
  await setActiveOrgCookie(n.org_id);
  redirect(hrefForRole(n.href, membership.role));
}
