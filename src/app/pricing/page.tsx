import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/constants/brand";
import { PRICING } from "@/constants/pricing";
import { FEATURES } from "@/components/marketing/content";
import {
  CtaBand,
  Faq,
  isSignedIn,
  PageHero,
  SiteShell,
  StartButton,
} from "@/components/marketing/blocks";

export const metadata: Metadata = {
  title: `Pricing · ${BRAND.name}`,
  description: `${PRICING.foundingOffer}. Players and parents are always free. No ${BRAND.name} fee on team dues.`,
};

export default async function PricingPage() {
  const signedIn = await isSignedIn();
  const { monthly, yearly } = PRICING.team;
  return (
    <SiteShell>
      <PageHero
        kicker="Pricing"
        title="Simple, per team."
        lead="Players and parents are always free. No fee on the dues you collect."
      />
      <section className="mx-auto max-w-6xl px-4 py-14">
        <p className="mx-auto mb-8 w-fit rounded-full bg-brand-100 px-4 py-2 text-center text-sm font-semibold text-brand-900">
          🎉 {PRICING.foundingOffer}
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col rounded-3xl bg-surface p-6 ring-1 ring-zinc-200">
            <h2 className="text-lg font-semibold">Players &amp; parents</h2>
            <p className="mt-2 text-4xl font-semibold">Free</p>
            <p className="text-sm text-zinc-500">always</p>
            <ul className="mt-5 space-y-2 text-sm text-zinc-700">
              <li>✓ Workouts, stats and video feedback</li>
              <li>✓ Live scores and game notifications</li>
              <li>✓ Schedule, RSVPs and messages</li>
              <li>✓ Register and pay dues online</li>
            </ul>
            <p className="mt-auto pt-6 text-sm text-zinc-500">Join from your team&apos;s link.</p>
          </div>
          <div className="flex flex-col rounded-3xl bg-surface p-6 ring-2 ring-brand-600">
            <h2 className="text-lg font-semibold">Team</h2>
            <p className="mt-2 text-4xl font-semibold">
              ${monthly}
              <span className="text-base font-normal text-zinc-500"> / month</span>
            </p>
            <p className="text-sm text-zinc-500">
              or ${yearly} a year · after your free founding season
            </p>
            <ul className="mt-5 space-y-2 text-sm text-zinc-700">
              {FEATURES.map((f) => (
                <li key={f.slug}>✓ {f.name}</li>
              ))}
              <li>✓ Unlimited players, parents and coaches</li>
            </ul>
            <StartButton signedIn={signedIn} className="mt-6" />
          </div>
          <div className="flex flex-col rounded-3xl bg-surface p-6 ring-1 ring-zinc-200">
            <h2 className="text-lg font-semibold">Club</h2>
            <p className="mt-2 text-4xl font-semibold">Custom</p>
            <p className="text-sm text-zinc-500">{PRICING.clubFrom}+ teams</p>
            <ul className="mt-5 space-y-2 text-sm text-zinc-700">
              <li>✓ Everything in Team, for every team</li>
              <li>✓ A lower price per team</li>
              <li>✓ Help moving your rosters and schedules over</li>
            </ul>
            <Link
              href="/for/coaches#clubs"
              className="mt-auto inline-flex h-12 items-center justify-center rounded-full font-semibold text-zinc-800 ring-1 ring-zinc-300 hover:bg-zinc-50"
            >
              See club features
            </Link>
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-3xl rounded-3xl bg-surface p-6 ring-1 ring-zinc-200">
          <h2 className="text-lg font-semibold">Collecting dues</h2>
          <p className="mt-1 text-zinc-600">
            Money goes straight to your team&apos;s own Stripe account, with no {BRAND.name} fee on
            top. Families pay the standard processing fee: bank transfers cost far less than cards,
            and they can pick monthly payments.
          </p>
        </div>
      </section>
      <Faq
        items={[
          [
            "What happens after the founding season?",
            `You choose: keep going on the Team plan ($${monthly} a month or $${yearly} a year), or stop. Nothing is charged without you choosing a plan.`,
          ],
          ["Do players or parents ever pay for the app?", "No. Only the team's plan has a price."],
          [
            "Is there a limit on players?",
            "No. Invite your whole roster, every parent and all your coaches.",
          ],
          [
            "Do you take a percentage of dues?",
            `No. ${BRAND.name} adds nothing to payments; only the processor's standard fee applies.`,
          ],
        ]}
      />
      <CtaBand
        signedIn={signedIn}
        title="Start free this season."
        lead="Set up your team in a few minutes and try it with a demo roster."
      />
    </SiteShell>
  );
}
