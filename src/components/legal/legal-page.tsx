import Link from "next/link";
import { BRAND } from "@/constants/brand";
import { Logo } from "@/components/brand/logo";

/** Shared frame for Privacy and Terms: readable width, draft notice, cross-links. */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
      <Link href="/" className="text-xl">
        <Logo markClassName="size-8" />
      </Link>
      <h1 className="mt-8 text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-zinc-500">
        {BRAND.legalName} · Last updated {updated}
      </p>
      <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
        Draft for legal review. Plain-language summary of how {BRAND.name} works today.
      </p>
      <div className="legal mt-8 space-y-6 text-[15px] leading-relaxed text-zinc-800 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-zinc-900 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
        {children}
      </div>
      <p className="mt-12 border-t border-zinc-200 pt-4 text-sm text-zinc-500">
        <Link href="/privacy" className="underline">
          Privacy Policy
        </Link>{" "}
        ·{" "}
        <Link href="/terms" className="underline">
          Terms of Service
        </Link>
      </p>
    </main>
  );
}
