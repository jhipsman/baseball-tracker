"use client";

import { useEffect, useRef, useState } from "react";

/** A purpose-built product film, framed as a preview rather than a page background. */
export function HeroPreview() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => {
      if (reducedMotion.matches) video.pause();
      else void video.play().catch(() => {});
    };
    syncMotion();
    reducedMotion.addEventListener("change", syncMotion);
    return () => {
      reducedMotion.removeEventListener("change", syncMotion);
      video.pause();
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-neutral-950 shadow-2xl ring-1 ring-zinc-900/10">
      <video
        ref={videoRef}
        muted
        loop
        playsInline
        preload="metadata"
        poster="/marketing/9d-hero-product-poster.jpg"
        aria-label="9D product preview showing team scheduling, live scoring, and player development"
        className="aspect-video w-full object-cover"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      >
        <source src="/marketing/9d-hero-product.mp4" type="video/mp4" />
      </video>
      <button
        type="button"
        aria-label={playing ? "Pause product preview" : "Play product preview"}
        onClick={() => {
          const video = videoRef.current;
          if (!video) return;
          if (video.paused) void video.play().catch(() => {});
          else video.pause();
        }}
        className="absolute right-5 bottom-5 grid size-11 place-items-center rounded-full bg-neutral-950/85 text-sm text-white ring-1 ring-white/50 focus-visible:outline-2 focus-visible:outline-offset-2 sm:right-6 sm:bottom-6"
      >
        {playing ? "Ⅱ" : "▶"}
      </button>
    </div>
  );
}
