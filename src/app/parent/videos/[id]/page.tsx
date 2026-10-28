import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireParent } from "@/lib/parent";
import { loadVideo } from "@/lib/videos";
import { VIDEO_TYPE_LABEL } from "@/constants/video";
import { VideoWorkspace } from "@/components/video/workspace";
import { PrivacyNote } from "../../parent-ui";

export const metadata: Metadata = { title: "Video" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ParentVideoPage({ params }: PageProps<"/parent/videos/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase, org, children: kids } = await requireParent();
  const video = await loadVideo(supabase, id, false);
  // RLS already hides other players' and unreviewed videos; check again to be explicit.
  if (
    !video ||
    video.orgId !== org.id ||
    video.status !== "reviewed" ||
    !kids.some((c) => c.id === video.playerId)
  ) {
    notFound();
  }
  const child = kids.find((c) => c.id === video.playerId)!;
  const back = kids.length > 1 ? `/parent/videos?player=${child.id}` : "/parent/videos";

  return (
    <div className="space-y-4">
      <div>
        <Link href={back} className="text-sm text-brand-700 hover:underline">
          ← Videos
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{video.title}</h1>
        <p className="text-sm text-zinc-600">
          {child.firstName} · {VIDEO_TYPE_LABEL[video.type]} ·{" "}
          {new Date(video.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </p>
      </div>
      {/* Read-only: "player" mode shows the coach's feedback without any editing tools. */}
      <VideoWorkspace
        video={video}
        mode="player"
        canDelete={false}
        aiEnabled={false}
        backHref={back}
      />
      <PrivacyNote />
    </div>
  );
}
