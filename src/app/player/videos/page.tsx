import type { Metadata } from "next";
import { requireActiveOrg } from "@/lib/org";
import { loadVideos } from "@/lib/videos";
import { VideoGrid } from "@/components/video/video-grid";
import { VideoUploadForm } from "@/components/video/upload-form";

export const metadata: Metadata = { title: "Videos" };

export default async function PlayerVideosPage() {
  const { supabase, user, org } = await requireActiveOrg();
  const videos = await loadVideos(supabase, org.id, { playerId: user.id });
  const reviewed = videos.filter((v) => v.status === "reviewed").length;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Videos</h1>
      <details
        className="group rounded-2xl bg-white p-4 ring-1 ring-zinc-200"
        open={videos.length === 0}
      >
        <summary className="cursor-pointer list-none font-semibold">
          <span className="group-open:hidden">＋ Upload a video for review</span>
          <span className="hidden group-open:inline">Upload a video for review</span>
        </summary>
        <div className="mt-4">
          <VideoUploadForm orgId={org.id} selfId={user.id} redirectTo="/player/videos/{id}" />
        </div>
      </details>
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-600">
          My videos{videos.length ? ` · ${reviewed} of ${videos.length} reviewed` : ""}
        </h2>
        <VideoGrid
          videos={videos}
          hrefBase="/player/videos"
          showPlayer={false}
          empty="Film a swing, a bullpen, or a lift and upload it. Your coach can draw on it, measure angles, and send back a voice-over breakdown."
        />
      </section>
    </div>
  );
}
