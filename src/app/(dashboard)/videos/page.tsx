import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { loadVideos } from "@/lib/videos";
import { VideoGrid } from "@/components/video/video-grid";
import { VideoUploadForm } from "@/components/video/upload-form";
import { selectClass } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Videos" };

const TABS = [
  { key: "pending", label: "Needs review" },
  { key: "reviewed", label: "Reviewed" },
  { key: "all", label: "All" },
] as const;

export default async function VideosPage({ searchParams }: PageProps<"/videos">) {
  const { supabase, org, isStaff } = await requireActiveOrg();
  if (!isStaff) redirect("/player/videos");
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab)?.key ?? "pending";
  const playerId = typeof sp.player === "string" ? sp.player : "";

  const [{ data: members }, videos, pending] = await Promise.all([
    supabase
      .from("org_memberships")
      .select("profile_id, profile:profiles (full_name, email)")
      .eq("org_id", org.id)
      .eq("role", "player"),
    loadVideos(supabase, org.id, {
      playerId: playerId || undefined,
      status: tab === "all" ? undefined : tab,
    }),
    loadVideos(supabase, org.id, { status: "pending", limit: 200 }),
  ]);
  const players = (members ?? [])
    .map((m) => ({ id: m.profile_id, name: m.profile?.full_name || m.profile?.email || "Player" }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const qs = (t: string) => `/videos?tab=${t}${playerId ? `&player=${playerId}` : ""}`;

  return (
    <div className="max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Videos</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Players upload swings, pitches, and reps; you draw, measure angles, record a voice-over,
          and send feedback. AI analysis is optional and always goes through you.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <nav className="flex gap-1" aria-label="Filter">
              {TABS.map((t) => (
                <Link
                  key={t.key}
                  href={qs(t.key)}
                  aria-current={tab === t.key ? "page" : undefined}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm font-medium",
                    tab === t.key
                      ? "bg-zinc-900 text-white"
                      : "bg-white text-zinc-700 ring-1 ring-zinc-300",
                  )}
                >
                  {t.label}
                  {t.key === "pending" && pending.length ? ` (${pending.length})` : ""}
                </Link>
              ))}
            </nav>
            <form className="ml-auto flex items-center gap-2" action="/videos">
              <input type="hidden" name="tab" value={tab} />
              <label htmlFor="player-filter" className="sr-only">
                Player
              </label>
              <select
                id="player-filter"
                name="player"
                defaultValue={playerId}
                className={selectClass}
              >
                <option value="">All players</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="h-11 rounded-lg bg-white px-3 text-sm font-semibold ring-1 ring-zinc-300"
              >
                Filter
              </button>
            </form>
          </div>
          <VideoGrid
            videos={videos}
            hrefBase="/videos"
            showPlayer
            empty={
              tab === "pending"
                ? "Nothing waiting for review. Players upload from the Videos tab on their phone, or upload one for them here."
                : "No videos yet."
            }
          />
        </div>
        <aside className="h-fit rounded-xl bg-white p-4 ring-1 ring-zinc-200">
          <h2 className="mb-3 font-semibold">Upload for a player</h2>
          <VideoUploadForm
            orgId={org.id}
            selfId={null}
            players={players}
            defaultPlayerId={playerId || undefined}
            redirectTo="/videos/{id}"
          />
        </aside>
      </div>
    </div>
  );
}
