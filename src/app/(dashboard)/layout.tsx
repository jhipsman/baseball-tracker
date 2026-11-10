import Link from "next/link";
import { NavLinks, type NavItem } from "@/components/layout/nav-links";
import { CoachNav, type CoachNavItem } from "@/components/layout/coach-nav";
import { Suspense } from "react";
import { LogoMark } from "@/components/brand/logo";
import { OrgSwitcher } from "@/components/layout/org-switcher";
import { SeasonToggle } from "@/components/layout/season-toggle";
import { TimezoneSync } from "@/components/layout/timezone-sync";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { playerToday } from "@/lib/player";
import { signOut } from "@/lib/auth/actions";
import { requireActiveOrg } from "@/lib/org";
import { ROLE_LABELS, SEASON_PHASE_LABELS } from "@/constants";
import { COACH_SECTIONS, visibleTabs } from "@/constants/sections";
import { NotificationBell } from "@/components/notifications/bell";
import { redirect } from "next/navigation";
import { billingState } from "@/lib/billing";
import { TrialBanner } from "@/components/billing/trial-banner";
import { TrialLock } from "@/components/billing/billing-buttons";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, org, membership, memberships, isStaff, preview } = await requireActiveOrg();
  if (preview) redirect(preview.role === "parent" ? "/parent" : "/player");
  if (membership.role === "parent") redirect("/parent");
  const { tz } = await playerToday();
  const billing = billingState(org);
  const sections: CoachNavItem[] = COACH_SECTIONS.flatMap((section) => {
    const tabs = visibleTabs(section, org.modules, membership.role === "admin");
    return tabs.length
      ? [
          {
            key: section.key,
            href: tabs[0].href,
            label: section.label,
            match: tabs.map((t) => t.href),
          },
        ]
      : [];
  });
  if (membership.role === "admin")
    sections.push({ key: "settings", href: "/settings", label: "Settings", match: ["/settings"] });
  const nav: NavItem[] = sections.map(({ href, label, match }) => ({ href, label, match }));

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <TimezoneSync current={tz ? decodeURIComponent(tz) : undefined} />
      <aside
        data-app-nav
        className="glass hidden md:sticky md:top-3 md:block md:m-3 md:mr-0 md:h-[calc(100dvh-1.5rem)] md:w-64 md:shrink-0 md:rounded-3xl md:border-0"
      >
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
          </div>
          {memberships.length > 1 ? (
            <OrgSwitcher orgs={memberships.map((m) => m.org)} activeId={org.id} />
          ) : null}
          <div className="space-y-1">
            <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Season</p>
            <SeasonToggle phase={org.current_season_phase} editable={isStaff} />
          </div>
          <NavLinks items={nav} />
          <div className="mt-auto border-t border-zinc-200 pt-4">
            <p className="truncate text-xs text-zinc-500">{user.email}</p>
            <Link
              href="/account"
              className="block text-sm font-medium text-zinc-700 hover:text-zinc-900"
            >
              Account
            </Link>
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
      {/* Phones: a slim bar on top, the menu at the bottom where thumbs reach. */}
      <header data-app-nav className="glass sticky top-0 z-20 md:hidden">
        <div className="flex h-14 items-center gap-2 px-4">
          <LogoMark className="size-6 shrink-0 text-brand-600" />
          <div className="min-w-0">
            <p className="truncate text-sm leading-tight font-semibold tracking-tight">
              {org.name}
            </p>
            <p className="text-[11px] leading-tight text-zinc-500">
              {SEASON_PHASE_LABELS[org.current_season_phase]}
              {org.is_demo ? " · Demo" : ""}
            </p>
          </div>
          <div className="ml-auto flex items-center">
            <NotificationBell />
          </div>
        </div>
      </header>
      <Suspense>
        <CoachNav
          items={sections}
          extras={
            <div className="space-y-4 border-t border-zinc-200 pt-4">
              {memberships.length > 1 ? (
                <OrgSwitcher orgs={memberships.map((m) => m.org)} activeId={org.id} />
              ) : null}
              <div className="space-y-1">
                <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                  Season
                </p>
                <SeasonToggle phase={org.current_season_phase} editable={isStaff} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-zinc-600">
                  <ThemeToggle /> Day / Night
                </div>
                <form action={signOut}>
                  <button
                    type="submit"
                    className="inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-300"
                  >
                    Sign out
                  </button>
                </form>
              </div>
              <p className="truncate text-xs text-zinc-500">{user.email}</p>
              <Link
                href="/account"
                className="inline-flex min-h-11 items-center text-sm font-medium text-zinc-700"
              >
                Account
              </Link>
            </div>
          }
        />
      </Suspense>
      <main className="min-w-0 flex-1 px-4 pt-5 pb-28 md:px-10 md:py-10">
        <div className="mx-auto w-full max-w-7xl [&>*]:mx-auto">
          <TrialBanner
            kind={billing.kind}
            daysLeft={billing.daysLeft}
            admin={membership.role === "admin"}
          />
          <TrialLock locked={billing.kind === "ended"}>{children}</TrialLock>
        </div>
      </main>
    </div>
  );
}
