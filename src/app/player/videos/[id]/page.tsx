import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { loadVideo } from "@/lib/videos";
import { VIDEO_TYPE_LABEL } from "@/constants/video";
import { VideoWorkspace } from "@/components/video/workspace";

export const metadata: Metadata = { title: "Video" };

export default async function PlayerVideoPage({ params }: PageProps<"/player/videos/[id]">) {
  const { id } = await params;
  const { supabase, user, org } = await requireActiveOrg();
  const video = await loadVideo(supabase, id, false);
  if (!video || video.orgId !== org.id || video.playerId !== user.id) notFound();

  return (
    <div className="space-y-4">
      <div>
        <Link href="/player/videos" className="text-sm text-brand-700 hover:underline">
          ← Videos
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{video.title}</h1>
        <p className="text-sm text-zinc-600">
          {VIDEO_TYPE_LABEL[video.type]} ·{" "}
          {new Date(video.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </p>
      </div>
      <VideoWorkspace
        video={video}
        mode="player"
        canDelete={video.uploadedBy === user.id}
        aiEnabled={false}
        backHref="/player/videos"
      />
    </div>
  );
}
