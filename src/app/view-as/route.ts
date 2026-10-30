import { NextResponse, type NextRequest } from "next/server";
import { requireRealActiveOrg } from "@/lib/org";
import { VIEW_AS_COOKIE } from "@/lib/view-as";

/** Start a read-only preview of the app as one of your team's players or parents (admins only). */
export async function GET(request: NextRequest) {
  const { supabase, org, membership } = await requireRealActiveOrg();
  const id = request.nextUrl.searchParams.get("id") ?? "";
  const back = new URL("/settings#preview", request.url);
  if (membership.role !== "admin") return NextResponse.redirect(back);

  const { data: target } = await supabase
    .from("org_memberships")
    .select("role")
    .eq("org_id", org.id)
    .eq("profile_id", id)
    .in("role", ["player", "parent"])
    .maybeSingle();
  if (!target) return NextResponse.redirect(back);

  const res = NextResponse.redirect(
    new URL(target.role === "parent" ? "/parent" : "/player", request.url),
  );
  res.cookies.set(VIEW_AS_COOKIE, id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    maxAge: 60 * 60 * 2,
  });
  return res;
}
