import Link from "next/link";
import { VIDEO_TYPE_LABEL } from "@/constants/video";
import { formatClock } from "@/lib/video/geometry";
import type { VideoListItem } from "@/lib/videos";
import { StatusBadge } from "./workspace";

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function VideoGrid({
  videos,
  hrefBase,
  showPlayer,
  empty,
}: {
  videos: VideoListItem[];
  hrefBase: string;
  showPlayer: boolean;
  empty: React.ReactNode;
}) {
  if (videos.length === 0) {
    return (
      <div className="rounded-xl bg-white p-6 text-sm text-zinc-600 ring-1 ring-zinc-200">
        {empty}
      </div>
    );
  }
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {videos.map((v) => (
        <li key={v.id}>
          <Link
            href={`${hrefBase}/${v.id}`}
            className="group block overflow-hidden rounded-xl bg-white ring-1 ring-zinc-200 hover:ring-brand-500"
          >
            <div className="relative aspect-video bg-zinc-900">
              {v.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.thumbUrl} alt="" className="size-full object-contain" loading="lazy" />
              ) : (
                <div
                  className="flex size-full items-center justify-center text-3xl text-zinc-500"
                  aria-hidden
                >
                  ▶
                </div>
              )}
              {v.durationS ? (
                <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-xs text-white">
                  {formatClock(Number(v.durationS)).replace(/\.\d$/, "")}
                </span>
              ) : null}
            </div>
            <div className="space-y-1 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="line-clamp-1 font-semibold text-zinc-900 group-hover:text-brand-800">
                  {v.title}
                </p>
                <StatusBadge status={v.status} />
              </div>
              <p className="text-xs text-zinc-500">
                {showPlayer ? `${v.playerName} · ` : ""}
                {VIDEO_TYPE_LABEL[v.type]} · {fmt(v.createdAt)}
                {v.hasBreakdown ? " · 🎙 Breakdown" : ""}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
