import { NavLinks, type NavItem } from "@/components/layout/nav-links";
import { OrgSwitcher } from "@/components/layout/org-switcher";
import { SeasonToggle } from "@/components/layout/season-toggle";
import { TimezoneSync } from "@/components/layout/timezone-sync";
import { playerToday } from "@/lib/player";
import { signOut } from "@/lib/auth/actions";
import { requireActiveOrg } from "@/lib/org";
import { ROLE_LABELS, SEASON_PHASE_LABELS } from "@/constants";
import { COACH_SECTIONS, visibleTabs } from "@/constants/sections";
import { NotificationBell } from "@/components/notifications/bell";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, org, membership, memberships, isStaff } = await requireActiveOrg();
  if (membership.role === "parent") redirect("/parent");
  const { tz } = await playerToday();
  const nav: NavItem[] = COACH_SECTIONS.flatMap((section) => {
    const tabs = visibleTabs(section, org.modules, membership.role === "admin");
    return tabs.length
      ? [{ href: tabs[0].href, label: section.label, match: tabs.map((t) => t.href) }]
      : [];
  });
  if (membership.role === "admin") nav.push({ href: "/settings", label: "Settings" });

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <TimezoneSync current={tz ? decodeURIComponent(tz) : undefined} />
      <aside className="border-b border-zinc-200 bg-white md:sticky md:top-0 md:h-dvh md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex h-full flex-col gap-4 p-4">
          <div className="flex items-center gap-2">
            <span aria-hidden className="inline-block size-5 rotate-45 rounded-sm bg-brand-700" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{org.name}</p>
              <p className="text-xs text-zinc-500">{ROLE_LABELS[membership.role]}</p>
            </div>
            <NotificationBell className="ml-auto" />
            <form action={signOut} className="md:hidden">
              <button type="submit" className="text-sm font-medium text-zinc-700">
                Sign out
              </button>
            </form>
          </div>
          {memberships.length > 1 ? (
            <OrgSwitcher orgs={memberships.map((m) => m.org)} activeId={org.id} />
          ) : null}
          <div className="hidden space-y-1 md:block">
            <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Season</p>
            <SeasonToggle phase={org.current_season_phase} editable={isStaff} />
          </div>
          {/* Phones: the season takes one line until tapped. */}
          <details className="group md:hidden">
            <summary className="flex h-11 cursor-pointer list-none items-center justify-between rounded-lg px-3 text-sm ring-1 ring-zinc-200">
              <span>
                Season: <strong>{SEASON_PHASE_LABELS[org.current_season_phase]}</strong>
              </span>
              <span aria-hidden className="text-zinc-500 group-open:rotate-180">
                ▾
              </span>
            </summary>
            <div className="pt-2">
              <SeasonToggle phase={org.current_season_phase} editable={isStaff} />
            </div>
          </details>
          <NavLinks items={nav} />
          <div className="mt-auto hidden border-t border-zinc-200 pt-4 md:block">
            <p className="truncate text-xs text-zinc-500">{user.email}</p>
            <form action={signOut}>
              <button
                type="submit"
                className="mt-1 text-sm font-medium text-zinc-700 hover:text-zinc-900"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto w-full max-w-7xl [&>*]:mx-auto">{children}</div>
      </main>
    </div>
  );
}
