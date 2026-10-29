import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ParentNav } from "@/components/layout/parent-nav";
import { TimezoneSync } from "@/components/layout/timezone-sync";
import { NotificationBell } from "@/components/notifications/bell";
import { signOut } from "@/lib/auth/actions";
import { requireActiveOrg } from "@/lib/org";
import { playerToday } from "@/lib/player";

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const { org, membership } = await requireActiveOrg();
  if (membership.role !== "parent") redirect("/");
  const { tz } = await playerToday();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50">
      <TimezoneSync current={tz ? decodeURIComponent(tz) : undefined} />
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-md items-center gap-2 px-4">
          <span aria-hidden className="inline-block size-4 rotate-45 rounded-sm bg-brand-700" />
          <span className="truncate text-sm font-semibold">{org.name}</span>
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell />
            <form action={signOut}>
              <button type="submit" className="px-2 text-sm font-medium text-zinc-600">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-4 pb-24">{children}</main>
      <Suspense>
        <ParentNav modules={org.modules} />
      </Suspense>
    </div>
  );
}
