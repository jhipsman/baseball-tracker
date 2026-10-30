import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { MyStats } from "@/components/stats/my-stats";

export const metadata: Metadata = { title: "My stats" };

export default async function PlayerStatsPage({ searchParams }: PageProps<"/player/stats">) {
  const { user, isStaff } = await requireActiveOrg();
  if (isStaff) redirect("/stats");
  const sp = await searchParams;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/player/profile" className="text-sm font-medium text-zinc-500">
          ← Me
        </Link>
        <h1 className="mt-1 text-2xl font-medium tracking-tight sm:text-3xl">My stats</h1>
      </div>
      <MyStats
        playerId={user.id}
        basePath="/player/stats"
        searchParams={sp}
        gameHref={(id) => `/player/games/${id}`}
      />
    </div>
  );
}
