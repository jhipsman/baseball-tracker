"use client";

import { useEffect, useRef, useState } from "react";
import { BRAND } from "@/constants/brand";

const FILM = "/marketing/9d-commercial.mp4";
const POSTER = "/marketing/9d-commercial-poster.jpg";

/**
 * Homepage opening: the 9D commercial loops silently behind the headline, under
 * a dark fade so the words stay readable. The band is night-lit in Day and Night,
 * like the film. "Watch the 1-minute film" opens it full size with sound.
 */
export function HeroFilm({ cta }: { cta: React.ReactNode }) {
  const bgRef = useRef<HTMLVideoElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const filmRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = bgRef.current;
    if (!video) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as { connection?: { saveData?: boolean } }).connection?.saveData;
    // The poster stands in when motion or data use isn't welcome.
    if (!reduced && !saveData) void video.play().catch(() => {});
    return () => video.pause();
  }, []);

  function togglePlay() {
    const video = bgRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => {});
    else video.pause();
  }

  function openFilm() {
    bgRef.current?.pause();
    dialogRef.current?.showModal();
    const film = filmRef.current;
    if (!film) return;
    film.currentTime = 0;
    void film.play().catch(() => {});
  }

  function onFilmClosed() {
    filmRef.current?.pause();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) void bgRef.current?.play().catch(() => {});
  }

  return (
    <section className="relative isolate flex min-h-[calc(100svh-4rem)] items-center overflow-hidden bg-neutral-950 text-white lg:min-h-[44rem]">
      <video
        ref={bgRef}
        aria-hidden
        tabIndex={-1}
        muted
        loop
        playsInline
        preload="auto"
        poster={POSTER}
        className="absolute inset-0 -z-20 size-full scale-105 object-cover object-[70%_50%]"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      >
        <source src={FILM} type="video/mp4" />
      </video>
      {/* Readability: dark from the text side, and a floor that fades into the page. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-neutral-950/80 lg:bg-transparent lg:bg-linear-to-r lg:from-neutral-950 lg:via-neutral-950/85 lg:to-neutral-950/20"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-linear-to-t from-neutral-950 to-transparent"
      />
      <div
        aria-hidden
        className="absolute -top-24 -left-24 -z-10 size-96 rounded-full bg-brand-500/20 blur-3xl"
      />

      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-widest text-neutral-100 uppercase ring-1 ring-white/20 backdrop-blur">
            <span aria-hidden className="size-1.5 rounded-full bg-brand-400" />
            {BRAND.tagline}
          </p>
          <h1 className="mt-5 font-wordmark text-6xl leading-[0.9] tracking-tight text-white uppercase italic drop-shadow-lg sm:text-8xl">
            Your whole season. <span className="block text-brand-400">One app.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-pretty text-neutral-200">
            Schedule, training, arm care, live scoring, registration and payments. For coaches,
            clubs, players and parents.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {cta}
            <button
              type="button"
              onClick={openFilm}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white/10 px-7 font-semibold text-white ring-1 ring-white/30 backdrop-blur hover:bg-white/20"
            >
              <span aria-hidden>▶</span> Watch the 1-minute film
            </button>
          </div>
          <p className="mt-4 text-sm text-neutral-300">
            30-day free trial · No card needed · Free for players and parents
          </p>
        </div>
      </div>

      <button
        type="button"
        aria-label={playing ? "Pause background video" : "Play background video"}
        onClick={togglePlay}
        className="absolute right-4 bottom-4 grid size-11 place-items-center rounded-full bg-neutral-950/70 text-sm text-white ring-1 ring-white/25 backdrop-blur hover:bg-neutral-900"
      >
        {playing ? "❚❚" : "▶"}
      </button>

      <dialog
        ref={dialogRef}
        aria-label={`${BRAND.name} film`}
        onClose={onFilmClosed}
        onClick={(e) => {
          if (e.target === e.currentTarget) dialogRef.current?.close();
        }}
        className="m-auto w-[min(64rem,calc(100vw-2rem))] max-w-none overflow-visible bg-transparent p-0 backdrop:bg-neutral-950/90 backdrop:backdrop-blur-sm"
      >
        <div className="flex justify-end pb-2">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="inline-flex h-11 items-center rounded-full bg-white/10 px-4 text-sm font-semibold text-white ring-1 ring-white/25 hover:bg-white/20"
          >
            Close ✕
          </button>
        </div>
        <video
          ref={filmRef}
          controls
          playsInline
          preload="none"
          poster={POSTER}
          aria-label={`${BRAND.name} commercial: scheduling, live scoring, arm care, player development, stats and team payments`}
          className="aspect-video w-full rounded-2xl bg-black shadow-2xl ring-1 ring-white/15"
        >
          <source src={FILM} type="video/mp4" />
        </video>
      </dialog>
    </section>
  );
}
