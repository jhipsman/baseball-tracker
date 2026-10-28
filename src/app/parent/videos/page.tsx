import type { Metadata } from "next";
import { pickChild, requireParent } from "@/lib/parent";
import { loadVideos } from "@/lib/videos";
import { VideoGrid } from "@/components/video/video-grid";
import { ChildSwitcher, NoLinkedPlayer, PrivacyNote } from "../parent-ui";

export const metadata: Metadata = { title: "Videos" };

export default async function ParentVideosPage({ searchParams }: PageProps<"/parent/videos">) {
  const sp = await searchParams;
  const { supabase, org, children: kids } = await requireParent();
  const child = pickChild(kids, sp.player);
  if (!child) return <NoLinkedPlayer />;

  // Reviewed only: drafts stay with the coach until feedback is sent (RLS enforces this too).
  const videos = await loadVideos(supabase, org.id, { playerId: child.id, status: "reviewed" });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{child.firstName}&apos;s videos</h1>
        <p className="text-sm text-zinc-600">
          Videos the coach has reviewed, with drawings, notes, and feedback.
        </p>
        <ChildSwitcher kids={kids} selected={child} basePath="/parent/videos" />
      </div>
      <VideoGrid
        videos={videos}
        hrefBase="/parent/videos"
        showPlayer={false}
        empty={`No reviewed videos yet. Once the coach reviews one of ${child.firstName}'s videos, it shows up here.`}
      />
      <PrivacyNote />
    </div>
  );
}
