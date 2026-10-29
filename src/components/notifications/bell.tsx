import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

/** Bell with the unread notification count; links to the notification list. */
async function UnreadBell({ className }: { className?: string }) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  const unread = count ?? 0;
  return <BellLink className={className} unread={unread} />;
}

/** Show the usable link immediately; the optional count streams in afterward. */
export function NotificationBell({ className }: { className?: string }) {
  return (
    <Suspense fallback={<BellLink className={className} />}>
      <UnreadBell className={className} />
    </Suspense>
  );
}

function BellLink({ className, unread = 0 }: { className?: string; unread?: number }) {
  return (
    <Link
      href="/notifications"
      aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      className={cn(
        "relative inline-flex size-10 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100",
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-6"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {unread ? (
        <span className="absolute -top-0.5 -right-0.5 min-w-5 rounded-full bg-red-600 px-1 text-center text-[11px] leading-5 font-semibold text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
