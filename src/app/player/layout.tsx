import Link from "next/link";
import { Suspense } from "react";
import { hasModule } from "@/constants/modules";
import { PlayerNav } from "@/components/layout/player-nav";
import { TimezoneSync } from "@/components/layout/timezone-sync";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { PageTransition } from "@/components/layout/page-transition";
import { requireActiveOrg } from "@/lib/org";
import { playerToday } from "@/lib/player";
import { NotificationBell } from "@/components/notifications/bell";
import { MessagesIconLink } from "@/components/messages/messages-icon-link";
import { redirect } from "next/navigation";

export default async function PlayerLayout({ children }: { children: React.ReactNode }) {
  const { org, isStaff, membership } = await requireActiveOrg();
  if (membership.role === "parent") redirect("/parent");
  const { tz } = await playerToday();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <TimezoneSync current={tz ? decodeURIComponent(tz) : undefined} />
      <header className="glass sticky top-0 z-20">
        <div className="mx-auto flex h-14 max-w-md items-center gap-2 px-4">
          <span aria-hidden className="inline-block size-4 rotate-45 rounded-[4px] bg-brand-600" />
          <span className="truncate text-sm font-semibold tracking-tight">{org.name}</span>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            {isStaff ? (
              <Link href="/" className="text-sm font-medium text-brand-700">
                Coach view
              </Link>
            ) : null}
            {hasModule(org.modules, "messages") ? (
              <MessagesIconLink href="/player/messages" />
            ) : null}
            <NotificationBell />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-4 pb-24">
        <PageTransition>{children}</PageTransition>
      </main>
      <Suspense>
        <PlayerNav modules={org.modules} />
      </Suspense>
    </div>
  );
}
