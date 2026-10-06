import Link from "next/link";
import { PlayerNav } from "@/components/layout/player-nav";
import { TimezoneSync } from "@/components/layout/timezone-sync";
import { requireActiveOrg } from "@/lib/org";
import { playerToday } from "@/lib/player";

export default async function PlayerLayout({ children }: { children: React.ReactNode }) {
  const { org, isStaff } = await requireActiveOrg();
  const { tz } = await playerToday();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50">
      <TimezoneSync current={tz ? decodeURIComponent(tz) : undefined} />
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-md items-center gap-2 px-4">
          <span aria-hidden className="inline-block size-4 rotate-45 rounded-sm bg-brand-700" />
          <span className="truncate text-sm font-semibold">{org.name}</span>
          {isStaff ? (
            <Link href="/" className="ml-auto text-sm font-medium text-brand-700">
              Coach view
            </Link>
          ) : null}
        </div>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-4 pb-24">{children}</main>
      <PlayerNav />
    </div>
  );
}
