import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isWriteRequest, VIEW_AS_COOKIE } from "@/lib/view-as";

export async function proxy(request: NextRequest) {
  // "View as" is a read-only preview: nothing can be saved, sent or deleted.
  if (request.cookies.has(VIEW_AS_COOKIE) && isWriteRequest(request.method)) {
    return NextResponse.json(
      { error: "You're previewing the app. Exit preview to make changes." },
      { status: 403 },
    );
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except static assets and image optimization.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw\\.js$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
