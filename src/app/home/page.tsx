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
import { HeroFilm } from "@/components/marketing/hero-film";

export const metadata: Metadata = {
  title: `${BRAND.name} · Built for baseball`,
  description:
    "Schedules, training, arm care, live scoring, registration and payments for baseball teams: one app for coaches, clubs, players and parents.",
};

export default async function HomePage() {
  const signedIn = await isSignedIn();
  return (
    <SiteShell>
      <HeroFilm cta={<StartButton signedIn={signedIn} />} />
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
