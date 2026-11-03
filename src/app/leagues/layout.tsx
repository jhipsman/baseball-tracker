import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { buttonClass } from "@/components/ui/button";
import { leaguesClient } from "@/lib/leagues-data";

export const metadata = {
  title: { default: "9D Leagues", template: "%s · 9D Leagues" },
  description:
    "Schedules, scores and records for baseball teams, from Little League to college. Free for any team.",
};

/** 9D Leagues: the public scores side of 9D, with its own header and footer. */
export default async function LeaguesLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await leaguesClient();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-surface-solid/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link href="/leagues" className="flex items-center gap-2" aria-label="9D Leagues home">
            <LogoMark className="size-7 text-brand-600" />
            <span className="font-wordmark text-2xl leading-none tracking-tight uppercase italic">
              9D <span className="text-brand-600">Leagues</span>
            </span>
          </Link>
          <nav className="ml-auto flex items-center gap-1">
            {userId ? (
              <Link
                href="/leagues/mine"
                className="hidden h-11 items-center rounded-full px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 sm:inline-flex"
              >
                My teams
              </Link>
            ) : null}
            <Link href="/leagues/new" className={buttonClass("primary", "h-10 px-4")}>
              Add a team
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-zinc-200">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <p>9D Leagues is free for every team. Scores are entered by each team.</p>
          <p>
            Want lineups, live scoring, arm care and payments?{" "}
            <Link href="/home" className="font-semibold text-brand-700">
              Run your team on 9D →
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
