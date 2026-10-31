import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/constants/brand";
import { Logo } from "@/components/brand/logo";
import { createClient } from "@/lib/supabase/server";
import {
  HealthMock,
  LiveMock,
  PaymentsMock,
  ScheduleMock,
  TrainingMock,
} from "@/components/marketing/mocks";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: `${BRAND.name} · Built for baseball`,
  description:
    "Schedules, training, arm care, live scoring, registration and payments for baseball teams: one app for coaches, players and parents.",
};

const FEATURES = [
  {
    id: "live",
    kicker: "Live scoring",
    title: "Score from the dugout. Parents watch it live.",
    body: "Tap each pitch and play. The score, count, runners and play-by-play update on every parent's phone in under a second.",
    points: [
      "Pitch counts and box scores fill in by themselves",
      "Spray charts from where the ball went",
    ],
    Mock: LiveMock,
  },
  {
    id: "health",
    kicker: "Player health",
    title: "Know every arm before the first pitch.",
    body: "Pitch Smart limits, rest days and one-tap arm check-ins, on one board. Set a player out with a return-to-throw plan.",
    points: [
      "Alerts for pain, soreness and workload spikes",
      "The pitcher picker warns you before you choose",
    ],
    Mock: HealthMock,
  },
  {
    id: "training",
    kicker: "Training",
    title: "Programs players actually finish.",
    body: "Build or start from templates. Players see today's workout, log it in seconds and see what they lifted last time.",
    points: ["Strength, throwing, hitting and arm care", "See who's done it, and who hasn't"],
    Mock: TrainingMock,
  },
  {
    id: "team",
    kicker: "Schedule & messages",
    title: "One place for when, where and who's coming.",
    body: "Games, practices and tournaments with RSVPs, directions and calendar links. Messages reach the right players and parents.",
    points: ["Changes notify the whole team", "Practice plans with stations and times"],
    Mock: ScheduleMock,
  },
  {
    id: "payments",
    kicker: "Registration & payments",
    title: "Sign-ups and dues without the spreadsheet.",
    body: "Share one link. Families register, sign the waiver and pay in full or monthly, by bank account or card.",
    points: [
      "Automatic reminders, never for autopay",
      "Money goes straight to your team's account",
    ],
    Mock: PaymentsMock,
  },
];

const AUDIENCES = [
  ["Coaches", "Lineups, pitch counts, practice plans and payments, from your phone."],
  ["Players", "Today's workout, your stats, your arm, your videos."],
  ["Parents", "Live scores, the schedule and payments, without the group text."],
];

export default async function HomePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims;
  const start = signedIn ? "/" : "/signup";
  const startLabel = signedIn ? `Open ${BRAND.name}` : "Start your team";

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="glass sticky top-0 z-30 border-b border-zinc-200/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link href="/" aria-label={`${BRAND.name} home`} className="text-lg">
            <Logo markClassName="size-7" />
          </Link>
          <nav aria-label="Product" className="ml-4 hidden gap-6 text-sm text-zinc-600 md:flex">
            <a href="#live" className="hover:text-zinc-900">
              Live scoring
            </a>
            <a href="#health" className="hover:text-zinc-900">
              Player health
            </a>
            <a href="#payments" className="hover:text-zinc-900">
              Registration
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {signedIn ? (
              <Link
                href="/"
                className="inline-flex h-10 items-center rounded-full bg-brand-700 px-4 text-sm font-semibold text-on-brand"
              >
                Open {BRAND.name}
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold text-zinc-800 ring-1 ring-zinc-300 hover:bg-zinc-50"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="hidden h-10 items-center rounded-full bg-brand-700 px-4 text-sm font-semibold text-on-brand sm:inline-flex"
                >
                  Start your team
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="hero">
          <div className="mx-auto max-w-6xl px-4 pt-14 pb-10 text-center sm:pt-20">
            <p className="text-sm font-semibold tracking-wide text-white/60 uppercase">
              {BRAND.tagline}
            </p>
            <h1 className="mx-auto mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
              Your whole season. One app.
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-pretty text-white/75">
              Schedule, training, arm care, live scoring, registration and payments, for coaches,
              players and parents.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href={start}
                className="inline-flex h-12 items-center justify-center rounded-full bg-brand-600 px-7 font-semibold text-on-brand hover:bg-brand-700"
              >
                {startLabel}
              </Link>
              <a
                href="#watch"
                className="inline-flex h-12 items-center justify-center rounded-full px-7 font-semibold text-white ring-1 ring-white/30 hover:bg-white/10"
              >
                ▶ Watch the 1-minute tour
              </a>
            </div>
            <div
              id="watch"
              className="mx-auto mt-12 max-w-4xl scroll-mt-24 overflow-hidden rounded-3xl shadow-2xl ring-1 ring-white/15"
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
          </div>
        </section>

        <section aria-label="Who it's for" className="mx-auto max-w-6xl px-4 py-14">
          <div className="grid gap-4 sm:grid-cols-3">
            {AUDIENCES.map(([who, what]) => (
              <div key={who} className="rounded-3xl bg-surface p-6 ring-1 ring-zinc-200">
                <h2 className="text-lg font-semibold">For {who.toLowerCase()}</h2>
                <p className="mt-1 text-zinc-600">{what}</p>
              </div>
            ))}
          </div>
        </section>

        {FEATURES.map((f, i) => (
          <section
            key={f.id}
            id={f.id}
            aria-labelledby={`${f.id}-title`}
            className="mx-auto grid max-w-6xl scroll-mt-20 items-center gap-8 px-4 py-12 md:grid-cols-2 md:gap-14 md:py-16"
          >
            <div className={cn(i % 2 === 1 && "md:order-2")}>
              <p className="text-sm font-semibold tracking-wide text-brand-700 uppercase">
                {f.kicker}
              </p>
              <h2
                id={`${f.id}-title`}
                className="mt-2 text-3xl font-semibold tracking-tight text-balance"
              >
                {f.title}
              </h2>
              <p className="mt-3 text-lg text-zinc-600">{f.body}</p>
              <ul className="mt-4 space-y-2">
                {f.points.map((p) => (
                  <li key={p} className="flex gap-2 text-zinc-800">
                    <span aria-hidden className="font-bold text-brand-600">
                      ✓
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            <div className={cn("mx-auto w-full max-w-md", i % 2 === 1 && "md:order-1")}>
              <f.Mock />
            </div>
          </section>
        ))}

        <section className="mx-auto max-w-6xl px-4 py-14">
          <div className="hero rounded-3xl px-6 py-12 text-center sm:px-12">
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Get your team on {BRAND.name}.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-white/75">
              Set up your team in a few minutes, try it with a demo roster, then invite players and
              parents.
            </p>
            <Link
              href={start}
              className="mt-7 inline-flex h-12 items-center justify-center rounded-full bg-brand-600 px-7 font-semibold text-on-brand hover:bg-brand-700"
            >
              {startLabel}
            </Link>
            {!signedIn ? (
              <p className="mt-4 text-sm text-white/70">
                Already on a team?{" "}
                <Link href="/login" className="font-semibold text-white underline">
                  Log in
                </Link>
              </p>
            ) : null}
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-8 text-sm text-zinc-500">
          <Logo markClassName="size-5" className="text-base text-zinc-800" />
          <span>
            © {new Date().getFullYear()} {BRAND.legalName}
          </span>
          <Link href="/privacy" className="hover:text-zinc-800">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-zinc-800">
            Terms
          </Link>
          <Link href="/login" className="ml-auto hover:text-zinc-800">
            Log in
          </Link>
        </div>
      </footer>
    </div>
  );
}
