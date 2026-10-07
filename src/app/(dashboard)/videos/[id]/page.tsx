import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { aiEnabled, loadVideo } from "@/lib/videos";
import { VIDEO_TYPE_LABEL } from "@/constants/video";
import { VideoWorkspace } from "@/components/video/workspace";

export const metadata: Metadata = { title: "Review video" };
// AI analysis can run long.
export const maxDuration = 120;

export default async function VideoReviewPage({ params }: PageProps<"/videos/[id]">) {
  const { id } = await params;
  const { supabase, org, isStaff } = await requireActiveOrg();
  if (!isStaff) redirect(`/player/videos/${id}`);
  const video = await loadVideo(supabase, id, true);
  if (!video || video.orgId !== org.id) notFound();

  return (
    <div className="max-w-7xl space-y-4">
      <div>
        <Link href="/videos" className="text-sm text-brand-700 hover:underline">
          ← Videos
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{video.title}</h1>
        <p className="text-sm text-zinc-600">
          <Link href={`/roster/${video.playerId}`} className="font-medium hover:underline">
            {video.playerName}
          </Link>{" "}
          · {VIDEO_TYPE_LABEL[video.type]} ·{" "}
          {new Date(video.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </p>
      </div>
      <VideoWorkspace
        video={video}
        mode="coach"
        canDelete
        aiEnabled={aiEnabled()}
        backHref="/videos"
      />
    </div>
  );
}
