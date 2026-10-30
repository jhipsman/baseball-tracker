import { NavLinks, type NavItem } from "@/components/layout/nav-links";
import { LogoMark } from "@/components/brand/logo";
import { OrgSwitcher } from "@/components/layout/org-switcher";
import { SeasonToggle } from "@/components/layout/season-toggle";
import { TimezoneSync } from "@/components/layout/timezone-sync";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { PageTransition } from "@/components/layout/page-transition";
import { playerToday } from "@/lib/player";
import { signOut } from "@/lib/auth/actions";
import { requireActiveOrg } from "@/lib/org";
import { ROLE_LABELS, SEASON_PHASE_LABELS } from "@/constants";
import { COACH_SECTIONS, visibleTabs } from "@/constants/sections";
import { NotificationBell } from "@/components/notifications/bell";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, org, membership, memberships, isStaff, preview } = await requireActiveOrg();
  if (preview) redirect(preview.role === "parent" ? "/parent" : "/player");
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
      <aside className="glass md:sticky md:top-3 md:m-3 md:mr-0 md:h-[calc(100dvh-1.5rem)] md:w-64 md:shrink-0 md:rounded-3xl md:border-0">
        <div className="flex h-full flex-col gap-4 p-4 md:overflow-y-auto md:p-5">
          <div className="flex items-center gap-2">
            <LogoMark className="size-7 text-brand-600 drop-shadow-[0_0_10px_rgb(18_183_106/0.45)]" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">{org.name}</p>
              <p className="text-xs text-zinc-500">
                {ROLE_LABELS[membership.role]}
                {org.is_demo ? (
                  <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900">
                    Demo
                  </span>
                ) : null}
              </p>
            </div>
            <div className="ml-auto flex items-center">
              <ThemeToggle />
              <NotificationBell />
            </div>
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
            <summary className="flex h-11 cursor-pointer list-none items-center justify-between rounded-full px-4 text-sm ring-1 ring-zinc-200">
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
      <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-10">
        <div className="mx-auto w-full max-w-7xl [&>*]:mx-auto">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>
    </div>
  );
}
