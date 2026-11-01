"use client";

import { useEffect, useRef, useState } from "react";
import { ScheduleMock, TrainingMock, LiveMock } from "./mocks";
import styles from "./motion.module.css";

const scenes = [
  { label: "Plan the week", title: "Everyone knows where to be.", Mock: ScheduleMock },
  { label: "Build players", title: "Give every player a clear next step.", Mock: TrainingMock },
  { label: "Follow the game", title: "Bring the dugout to every family.", Mock: LiveMock },
];

export function HeroPreview() {
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scene = scenes[selected];

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => {
      if (reducedMotion.matches) {
        video.pause();
      } else {
        void video.play().catch(() => {});
      }
    };
    syncMotion();
    reducedMotion.addEventListener("change", syncMotion);
    return () => {
      reducedMotion.removeEventListener("change", syncMotion);
      video.pause();
    };
  }, []);

  return (
    <div className="rounded-3xl bg-surface p-4 ring-1 ring-zinc-200 sm:p-6">
      <div className="mb-5 flex items-center justify-between text-xs font-semibold text-zinc-600">
        <span>ONE TEAM. CONNECTED.</span>
        <span>Sample team</span>
      </div>
      <div className="relative mb-5 h-28 overflow-hidden rounded-2xl bg-neutral-950 sm:h-36">
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          preload="metadata"
          poster="/marketing/9d-hero-poster.jpg"
          aria-hidden="true"
          className="absolute inset-0 size-full object-cover opacity-75"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        >
          <source src="/marketing/9d-hero-loop.mp4" type="video/mp4" />
        </video>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-neutral-950/70 via-transparent to-neutral-950/20" />
        <span className="absolute bottom-3 left-4 text-xs font-semibold tracking-wide text-white">
          A LOOK INSIDE 9D
        </span>
        <button
          type="button"
          aria-label={playing ? "Pause product video" : "Play product video"}
          onClick={() => {
            const video = videoRef.current;
            if (!video) return;
            if (video.paused) void video.play().catch(() => {});
            else video.pause();
          }}
          className="absolute right-3 bottom-2 z-10 grid size-11 place-items-center rounded-full bg-neutral-950/80 text-sm text-white ring-1 ring-white/40 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {playing ? "Ⅱ" : "▶"}
        </button>
      </div>
      <div
        role="tablist"
        aria-label="Explore 9D"
        className="mb-6 grid grid-cols-3 gap-1 rounded-2xl bg-surface p-1"
      >
        {scenes.map((item, index) => (
          <button
            key={item.label}
            id={`hero-tab-${index}`}
            role="tab"
            aria-selected={selected === index}
            aria-controls="hero-preview"
            tabIndex={selected === index ? 0 : -1}
            onClick={() => setSelected(index)}
            onKeyDown={(event) => {
              const next =
                event.key === "ArrowRight"
                  ? (index + 1) % scenes.length
                  : event.key === "ArrowLeft"
                    ? (index + scenes.length - 1) % scenes.length
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? scenes.length - 1
                        : null;
              if (next === null) return;
              event.preventDefault();
              setSelected(next);
              document.getElementById(`hero-tab-${next}`)?.focus();
            }}
            className={`${styles.tab} min-h-12 rounded-xl px-2 py-2 text-xs font-semibold ${selected === index ? "bg-zinc-900 text-zinc-50 shadow-sm" : "text-zinc-600 hover:bg-zinc-100"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        id="hero-preview"
        role="tabpanel"
        aria-labelledby={`hero-tab-${selected}`}
        tabIndex={0}
        className="min-h-[320px]"
      >
        <div key={selected} className={styles.preview}>
          <scene.Mock />
          <p className="mt-5 text-center text-sm font-medium text-zinc-700">{scene.title}</p>
        </div>
      </div>
    </div>
  );
}
