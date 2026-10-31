"use client";

import { useEffect, useMemo, useRef, useState, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import { demoSearchUrl, parseDemoVideo, type DemoVideo } from "@/lib/exercise-video";
import { cn } from "@/lib/utils";
import { ViewButton } from "@/components/ui/view-button";

// Keep clicks/keys inside the modal from reaching parents (e.g. drag handles in the
// builder library, whose listeners are React props and see portal events).
const stop = (e: SyntheticEvent) => e.stopPropagation();

function DemoDialog({
  name,
  video,
  onClose,
}: {
  name: string;
  video: DemoVideo;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  return createPortal(
    <dialog
      ref={ref}
      aria-label={`${name} demo`}
      onClose={onClose}
      onPointerDown={stop}
      onTouchStart={stop}
      onKeyDown={stop}
      onClick={(e) => {
        stop(e);
        // A click on the backdrop lands on the <dialog> itself.
        if (e.target === e.currentTarget) ref.current?.close();
      }}
      className="m-auto w-[min(56rem,calc(100vw-1rem))] max-w-none overflow-hidden rounded-2xl bg-neutral-950 p-0 text-white shadow-2xl backdrop:bg-black/70"
    >
      <div className="flex items-center gap-3 px-4 py-2.5">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{name}</p>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          className="h-9 shrink-0 rounded-lg px-3 text-sm font-semibold text-neutral-200 ring-1 ring-neutral-700 hover:bg-neutral-800"
        >
          Close
        </button>
      </div>
      <div
        className={cn(
          "mx-auto bg-black",
          video.vertical ? "aspect-[9/16] max-h-[78vh]" : "aspect-video w-full",
        )}
      >
        {video.kind === "file" ? (
          <video
            src={video.src}
            controls
            playsInline
            preload="metadata"
            className="h-full w-full"
          />
        ) : (
          <iframe
            src={video.embedUrl}
            title={`${name} demo video`}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="h-full w-full border-0"
          />
        )}
      </div>
    </dialog>,
    document.body,
  );
}

/**
 * "▶ Demo" button that plays the exercise's demo video in a modal without leaving
 * the page, or a "Find a demo" YouTube search link when the exercise has none.
 * The player is only created after the button is tapped.
 */
export function ExerciseDemo({
  name,
  url,
  compact = false,
  showSearch = true,
  className,
}: {
  name: string;
  url: string | null | undefined;
  /** Icon-sized trigger for tight rows (builder library). */
  compact?: boolean;
  /** Render the "Find a demo" fallback when there is no video. */
  showSearch?: boolean;
  className?: string;
}) {
  const video = useMemo(() => parseDemoVideo(url), [url]);
  const [open, setOpen] = useState(false);

  if (!video) {
    if (!showSearch) return null;
    return (
      <a
        href={demoSearchUrl(name)}
        target="_blank"
        rel="noopener noreferrer"
        onPointerDown={stop}
        className={cn(
          "inline-flex shrink-0 items-center gap-1 text-xs font-medium text-zinc-500 hover:text-brand-700 hover:underline",
          className,
        )}
      >
        Find a demo<span aria-hidden>↗</span>
        <span className="sr-only"> for {name} on YouTube (opens in a new tab)</span>
      </a>
    );
  }

  return (
    <>
      <ViewButton
        onPointerDown={stop}
        onTouchStart={stop}
        onKeyDown={stop}
        onPress={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`Watch ${name} demo`}
        className={cn(
          compact
            ? "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-xs text-brand-700 hover:bg-brand-50"
            : "inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-full bg-brand-50 px-3 text-xs font-semibold text-brand-900 ring-1 ring-brand-500/30 ring-inset hover:bg-brand-100",
          className,
        )}
      >
        <span aria-hidden>▶</span>
        {compact ? null : "Demo"}
      </ViewButton>
      {open ? <DemoDialog name={name} video={video} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
