import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BRAND } from "@/constants/brand";
import { FEATURES, featureBySlug } from "@/components/marketing/content";
import { CtaBand, isSignedIn, PageHero, SiteShell } from "@/components/marketing/blocks";

export function generateStaticParams() {
  return FEATURES.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/features/[slug]">): Promise<Metadata> {
  const f = featureBySlug((await params).slug);
  return f ? { title: f.name, description: f.body } : {};
}

export default async function FeaturePage({ params }: PageProps<"/features/[slug]">) {
  const f = featureBySlug((await params).slug);
  if (!f) notFound();
  const signedIn = await isSignedIn();
  const others = FEATURES.filter((x) => x.slug !== f.slug);
  return (
    <SiteShell>
      <PageHero kicker={`${f.icon} ${f.name}`} title={f.title} lead={f.body} />
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-2">
        <div className="mx-auto w-full max-w-md md:order-2">
          <f.Mock />
        </div>
        <ul className="space-y-6">
          {f.details.map((d) => (
            <li key={d.title}>
              <h2 className="text-xl font-semibold">{d.title}</h2>
              <p className="mt-1 text-zinc-600">{d.text}</p>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="more" className="mx-auto max-w-6xl px-4 pb-6">
        <h2 id="more" className="text-lg font-semibold">
          More in {BRAND.name}
        </h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {others.map((o) => (
            <li key={o.slug}>
              <Link
                href={`/features/${o.slug}`}
                className="flex h-full gap-3 rounded-2xl bg-surface p-4 ring-1 ring-zinc-200 hover:ring-zinc-300"
              >
                <span aria-hidden className="text-xl">
                  {o.icon}
                </span>
                <span>
                  <b className="block">{o.name}</b>
                  <span className="text-sm text-zinc-600">{o.line}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <CtaBand
        signedIn={signedIn}
        title={`Get your team on ${BRAND.name}.`}
        lead="Everything here comes with every team. Set up in a few minutes."
      />
    </SiteShell>
  );
}
