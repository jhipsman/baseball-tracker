import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BRAND } from "@/constants/brand";
import { AUDIENCES, audienceBySlug } from "@/components/marketing/content";
import {
  CtaBand,
  DayTimeline,
  Faq,
  FeatureRow,
  isSignedIn,
  PageHero,
  SiteShell,
  StartButton,
} from "@/components/marketing/blocks";
import { ClubMock } from "@/components/marketing/mocks";

export function generateStaticParams() {
  return AUDIENCES.map((a) => ({ audience: a.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/for/[audience]">): Promise<Metadata> {
  const a = audienceBySlug((await params).audience);
  return a
    ? { title: { absolute: `${BRAND.name} for ${a.label.toLowerCase()}` }, description: a.lead }
    : {};
}

export default async function AudiencePage({ params }: PageProps<"/for/[audience]">) {
  const a = audienceBySlug((await params).audience);
  if (!a) notFound();
  const signedIn = await isSignedIn();
  const coaches = a.slug === "coaches";
  return (
    <SiteShell>
      <PageHero kicker={`For ${a.label.toLowerCase()}`} title={a.title} lead={a.lead}>
        {coaches ? (
          <div className="mt-8 flex justify-center">
            <StartButton signedIn={signedIn} />
          </div>
        ) : null}
      </PageHero>
      {a.jobs.map((j, i) => (
        <FeatureRow
          key={j.title}
          kicker={`${i + 1} of ${a.jobs.length}`}
          title={j.title}
          body={j.text}
          Mock={j.Mock}
          flip={i % 2 === 1}
        />
      ))}
      {coaches ? (
        <FeatureRow
          id="clubs"
          kicker="For clubs"
          title="One account for every team."
          body="Run several teams or age groups under one club. Each gets its own schedule, messages and registration link, and you see every team's sign-ups and payments."
          points={[
            "Switch between teams in one tap",
            "Bring rosters and schedules from spreadsheets, GameChanger or LeagueApps",
          ]}
          Mock={ClubMock}
          flip
        />
      ) : null}
      <DayTimeline title={a.day.title} beats={a.day.beats} />
      <Faq items={a.faq} />
      <CtaBand
        signedIn={signedIn}
        title={coaches ? `Get your team on ${BRAND.name}.` : `Ask your coach about ${BRAND.name}.`}
        lead={
          coaches
            ? "Set up in a few minutes, try it with a demo roster, then invite players and parents."
            : "Players and parents join from their team's invite or registration link, always free."
        }
      />
    </SiteShell>
  );
}
