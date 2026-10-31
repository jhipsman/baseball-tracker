import type { Metadata } from "next";
import { BRAND } from "@/constants/brand";
import {
  CtaBand,
  isSignedIn,
  PageHero,
  SiteShell,
  StartButton,
  WhyStrip,
} from "@/components/marketing/blocks";
import { AudienceSwitch, FeatureTabs } from "@/components/marketing/switchers";

export const metadata: Metadata = {
  title: `${BRAND.name} · Built for baseball`,
  description:
    "Schedules, training, arm care, live scoring, registration and payments for baseball teams: one app for coaches, clubs, players and parents.",
};

export default async function HomePage() {
  const signedIn = await isSignedIn();
  return (
    <SiteShell>
      <PageHero
        kicker={BRAND.tagline}
        title="Your whole season. One app."
        lead="Schedule, training, arm care, live scoring, registration and payments, for coaches, players and parents."
      >
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <StartButton signedIn={signedIn} />
          <a
            href="#watch"
            className="inline-flex h-12 items-center justify-center rounded-full bg-surface px-7 font-semibold text-zinc-900 ring-1 ring-zinc-300 hover:bg-zinc-50"
          >
            ▶ Watch the 1-minute tour
          </a>
        </div>
        <div
          id="watch"
          className="mx-auto mt-12 max-w-4xl scroll-mt-24 overflow-hidden rounded-3xl shadow-2xl ring-1 ring-zinc-900/10"
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
      </PageHero>
      <AudienceSwitch />
      <FeatureTabs />
      <WhyStrip />
      <CtaBand
        signedIn={signedIn}
        title={`Get your team on ${BRAND.name}.`}
        lead="Set up your team in a few minutes, try it with a demo roster, then invite players and parents."
      />
    </SiteShell>
  );
}
