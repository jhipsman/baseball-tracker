"use client";

import { useEffect, useRef, useState } from "react";

export function HeroMotion() {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      if (preference.matches) video.pause();
      else void video.play().catch(() => {});
    };
    sync();
    preference.addEventListener("change", sync);
    return () => {
      preference.removeEventListener("change", sync);
      video.pause();
    };
  }, []);
  return (
    <>
      <video
        ref={ref}
        muted
        loop
        playsInline
        preload="none"
        poster="/marketing/9d-commercial-poster.jpg"
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover opacity-35"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      >
        <source src="/marketing/9d-hero-loop.mp4" type="video/mp4" />
      </video>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-neutral-950 via-neutral-950/80 to-neutral-950/30" />
      <button
        type="button"
        aria-label={playing ? "Pause background video" : "Play background video"}
        onClick={() => {
          const video = ref.current;
          if (!video) return;
          if (video.paused) void video.play().catch(() => {});
          else video.pause();
        }}
        className="absolute right-4 bottom-4 z-10 min-h-11 rounded-full border border-neutral-500 bg-neutral-950/80 px-4 text-sm text-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {playing ? "Pause motion" : "Play motion"}
      </button>
    </>
  );
}
