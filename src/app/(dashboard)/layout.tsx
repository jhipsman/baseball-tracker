import { NavLinks, type NavItem } from "@/components/layout/nav-links";
import { signOut } from "@/lib/auth/actions";
import { requireActiveOrg } from "@/lib/org";
import { ROLE_LABELS } from "@/constants";

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard" },
  { href: "/exercises", label: "Exercises" },
  { href: "/programs", label: "Programs", soon: true },
  { href: "/roster", label: "Roster", soon: true },
  { href: "/calendar", label: "Calendar", soon: true },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, org, membership } = await requireActiveOrg();

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <aside className="border-b border-zinc-200 bg-white md:sticky md:top-0 md:h-dvh md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex h-full flex-col gap-4 p-4">
          <div className="flex items-center gap-2">
            <span aria-hidden className="inline-block size-5 rotate-45 rounded-sm bg-brand-700" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{org.name}</p>
              <p className="text-xs text-zinc-500">{ROLE_LABELS[membership.role]}</p>
            </div>
          </div>
          <NavLinks items={NAV} />
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
      <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
