import Link from "next/link";
import { PlayerNav } from "@/components/layout/player-nav";
import { TimezoneSync } from "@/components/layout/timezone-sync";
import { requireActiveOrg } from "@/lib/org";
import { playerToday } from "@/lib/player";
import { NotificationBell } from "@/components/notifications/bell";
import { redirect } from "next/navigation";

export default async function PlayerLayout({ children }: { children: React.ReactNode }) {
  const { org, isStaff, membership } = await requireActiveOrg();
  if (membership.role === "parent") redirect("/parent");
  const { tz } = await playerToday();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50">
      <TimezoneSync current={tz ? decodeURIComponent(tz) : undefined} />
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-md items-center gap-2 px-4">
          <span aria-hidden className="inline-block size-4 rotate-45 rounded-sm bg-brand-700" />
          <span className="truncate text-sm font-semibold">{org.name}</span>
          <div className="ml-auto flex items-center gap-1">
            {isStaff ? (
              <Link href="/" className="text-sm font-medium text-brand-700">
                Coach view
              </Link>
            ) : null}
            <Link
              href="/player/messages"
              aria-label="Messages"
              className="inline-flex size-10 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100"
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
                <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
              </svg>
            </Link>
            <NotificationBell />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-4 pb-24">{children}</main>
      <PlayerNav />
    </div>
  );
}
