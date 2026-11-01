import type { Metadata } from "next";
import { BRAND } from "@/constants/brand";
import {
  CtaBand,
  isSignedIn,
  SiteShell,
  StartButton,
  WhyStrip,
} from "@/components/marketing/blocks";
import { AudienceSwitch, FeatureTabs } from "@/components/marketing/switchers";
import { HeroMotion } from "@/components/marketing/hero-motion";

export const metadata: Metadata = {
  title: `${BRAND.name} · Built for baseball`,
  description:
    "Schedules, training, arm care, live scoring, registration and payments for baseball teams: one app for coaches, clubs, players and parents.",
};

export default async function HomePage() {
  const signedIn = await isSignedIn();
  return (
    <SiteShell>
      <section className="relative isolate overflow-hidden bg-neutral-950 text-neutral-50">
        <HeroMotion />
        <div className="relative mx-auto max-w-6xl px-6 pt-20 pb-28 sm:pt-28 sm:pb-32">
          <p className="text-sm font-semibold tracking-widest text-neutral-300 uppercase">
            {BRAND.tagline}
          </p>
          <h1 className="mt-4 max-w-2xl text-5xl font-semibold tracking-tight text-balance sm:text-7xl">
            Your whole season.
            <br />
            One app.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-neutral-200">
            Schedule, training, arm care, live scoring, registration and payments, for coaches,
            players and parents.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <StartButton signedIn={signedIn} />
            <a
              href="#watch"
              className="inline-flex h-12 items-center justify-center rounded-full bg-surface px-7 font-semibold text-zinc-900 ring-1 ring-zinc-300 hover:bg-zinc-50"
            >
              ▶ See 9D in action
            </a>
          </div>
        </div>
      </section>
      <AudienceSwitch />
      <FeatureTabs />
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-semibold tracking-wide text-brand-700 uppercase">
            See the season come together
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Less chasing updates. More baseball.
          </h2>
          <p className="mt-4 text-zinc-600">
            A quick highlights tour of scheduling, training, arm care, live games and team payments.
          </p>
        </div>
        <div
          id="watch"
          className="scroll-mt-24 overflow-hidden rounded-3xl shadow-2xl ring-1 ring-zinc-900/10"
        >
          <video
            className="aspect-video w-full bg-black"
            controls
            playsInline
            preload="none"
            poster="/marketing/9d-commercial-poster.jpg"
            aria-label={`${BRAND.name} product tour`}
          >
            <source src="/marketing/9d-commercial.mp4" type="video/mp4" />
          </video>
        </div>
      </section>
      <WhyStrip />
      <CtaBand
        signedIn={signedIn}
        title={`Get your team on ${BRAND.name}.`}
        lead="Set up your team in a few minutes, try it with a demo roster, then invite players and parents."
      />
    </SiteShell>
  );
}
