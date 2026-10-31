import Link from "next/link";
import { BRAND } from "@/constants/brand";
import { Logo } from "@/components/brand/logo";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "./site-header";
import { AUDIENCES, FEATURES, WHY } from "./content";
import { cn } from "@/lib/utils";

export async function isSignedIn() {
  const { data } = await (await createClient()).auth.getClaims();
  return !!data?.claims;
}

/** Header, page, footer. */
export async function SiteShell({ children }: { children: React.ReactNode }) {
  const signedIn = await isSignedIn();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader signedIn={signedIn} />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-zinc-200">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:grid-cols-4">
          <div className="space-y-2">
            <Logo markClassName="size-6" className="text-lg text-zinc-900" />
            <p className="text-zinc-500">{BRAND.tagline}</p>
          </div>
          <div>
            <p className="font-semibold text-zinc-900">Features</p>
            <ul className="mt-2 space-y-1.5">
              {FEATURES.map((f) => (
                <li key={f.slug}>
                  <Link href={`/features/${f.slug}`} className="text-zinc-600 hover:text-zinc-900">
                    {f.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold text-zinc-900">Who it&apos;s for</p>
            <ul className="mt-2 space-y-1.5">
              {AUDIENCES.map((a) => (
                <li key={a.slug}>
                  <Link href={`/for/${a.slug}`} className="text-zinc-600 hover:text-zinc-900">
                    {a.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/pricing" className="text-zinc-600 hover:text-zinc-900">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-zinc-900">{BRAND.legalName}</p>
            <ul className="mt-2 space-y-1.5">
              <li>
                <Link href="/login" className="text-zinc-600 hover:text-zinc-900">
                  Log in
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-zinc-600 hover:text-zinc-900">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-zinc-600 hover:text-zinc-900">
                  Terms
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="pb-8 text-center text-xs text-zinc-500">
          © {new Date().getFullYear()} {BRAND.legalName}
        </p>
      </footer>
    </div>
  );
}

export function StartButton({ signedIn, className }: { signedIn: boolean; className?: string }) {
  return (
    <Link
      href={signedIn ? "/" : "/signup"}
      className={cn(
        "inline-flex h-12 items-center justify-center rounded-full bg-brand-600 px-7 font-semibold text-on-brand hover:bg-brand-700",
        className,
      )}
    >
      {signedIn ? `Open ${BRAND.name}` : "Start your team"}
    </Link>
  );
}

/** Dark opening band used at the top of every page. */
export function PageHero({
  kicker,
  title,
  lead,
  children,
}: {
  kicker: string;
  title: string;
  lead: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="hero">
      <div className="mx-auto max-w-6xl px-4 pt-14 pb-14 text-center sm:pt-20">
        <p className="text-sm font-semibold tracking-wide text-white/60 uppercase">{kicker}</p>
        <h1 className="mx-auto mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          {title}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-pretty text-white/75">{lead}</p>
        {children}
      </div>
    </section>
  );
}

/** Text on one side, a product preview on the other; alternates by index. */
export function FeatureRow({
  id,
  kicker,
  title,
  body,
  points,
  Mock,
  flip,
  more,
}: {
  id?: string;
  kicker: string;
  title: string;
  body: string;
  points?: string[];
  Mock: () => React.JSX.Element;
  flip?: boolean;
  more?: { href: string; label: string };
}) {
  return (
    <section
      id={id}
      className="mx-auto grid max-w-6xl scroll-mt-20 items-center gap-8 px-4 py-12 md:grid-cols-2 md:gap-14 md:py-16"
    >
      <div className={cn(flip && "md:order-2")}>
        <p className="text-sm font-semibold tracking-wide text-brand-700 uppercase">{kicker}</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance">{title}</h2>
        <p className="mt-3 text-lg text-zinc-600">{body}</p>
        {points?.length ? (
          <ul className="mt-4 space-y-2">
            {points.map((p) => (
              <li key={p} className="flex gap-2 text-zinc-800">
                <span aria-hidden className="font-bold text-brand-600">
                  ✓
                </span>
                {p}
              </li>
            ))}
          </ul>
        ) : null}
        {more ? (
          <Link
            href={more.href}
            className="mt-5 inline-flex min-h-11 items-center font-semibold text-brand-700 hover:underline"
          >
            {more.label} →
          </Link>
        ) : null}
      </div>
      <div className={cn("mx-auto w-full max-w-md", flip && "md:order-1")}>
        <Mock />
      </div>
    </section>
  );
}

/** "A day with 9D": five short beats on a line. */
export function DayTimeline({ title, beats }: { title: string; beats: [string, string][] }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      <ol className="mx-auto mt-8 grid max-w-5xl gap-4 sm:grid-cols-5 sm:gap-3">
        {beats.map(([when, what], i) => (
          <li key={i} className="relative flex gap-3 sm:flex-col sm:gap-2">
            <span className="flex shrink-0 items-center gap-2 sm:w-full">
              <span className="grid size-8 place-items-center rounded-full bg-zinc-900 text-xs font-bold text-zinc-50">
                {i + 1}
              </span>
              <span aria-hidden className="hidden h-px flex-1 bg-zinc-200 sm:block" />
            </span>
            <span>
              <b className="block text-sm text-brand-700">{when}</b>
              <span className="text-zinc-700">{what}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Questions stay closed until someone opens them. */
export function Faq({ items, title = "Questions" }: { items: [string, string][]; title?: string }) {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      <div className="mt-6 divide-y divide-zinc-200 rounded-2xl bg-surface ring-1 ring-zinc-200">
        {items.map(([q, a]) => (
          <details key={q} className="group px-5">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-semibold">
              {q}
              <span aria-hidden className="text-zinc-400 transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="pb-4 text-zinc-600">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function WhyStrip() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <div className="grid gap-4 sm:grid-cols-3">
        {WHY.map(([t, d]) => (
          <div key={t} className="rounded-3xl bg-surface p-6 ring-1 ring-zinc-200">
            <h2 className="text-lg font-semibold">{t}</h2>
            <p className="mt-1 text-zinc-600">{d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function CtaBand({
  signedIn,
  title,
  lead,
}: {
  signedIn: boolean;
  title: string;
  lead: string;
}) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-14">
      <div className="hero rounded-3xl px-6 py-12 text-center sm:px-12">
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
        <p className="mx-auto mt-3 max-w-xl text-white/75">{lead}</p>
        <StartButton signedIn={signedIn} className="mt-7" />
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
  );
}
