import { NextResponse, type NextRequest } from "next/server";
import { VIEW_AS_COOKIE } from "@/lib/view-as";

/** End the preview and go back to Settings (or a same-site `next` path). */
export function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next");
  const target =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/settings#preview";
  const res = NextResponse.redirect(new URL(target, request.url));
  res.cookies.delete(VIEW_AS_COOKIE);
  return res;
}
