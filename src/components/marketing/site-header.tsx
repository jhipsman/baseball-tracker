"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BRAND } from "@/constants/brand";
import { Logo } from "@/components/brand/logo";
import { FEATURES } from "./content";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/for/coaches", label: "Coaches & Clubs" },
  { href: "/for/players", label: "Players" },
  { href: "/for/parents", label: "Parents" },
  { href: "/pricing", label: "Pricing" },
  { href: "/leagues", label: "9D Leagues" },
];

/** Public site header: Features menu, audience pages, pricing, and a separate Log in. */
export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const [features, setFeatures] = useState(false);
  const featuresRef = useRef<HTMLDivElement>(null);
  // Close menus when the page changes or on a click elsewhere / Escape.
  const [seen, setSeen] = useState(pathname);
  if (seen !== pathname) {
    setSeen(pathname);
    setMenu(false);
    setFeatures(false);
  }
  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (!featuresRef.current?.contains(e.target as Node)) setFeatures(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFeatures(false);
        setMenu(false);
      }
    };
    document.addEventListener("click", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("click", away);
      document.removeEventListener("keydown", esc);
    };
  }, []);

  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="glass sticky top-0 z-30 border-b border-zinc-200/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4">
        <Link href="/" aria-label={`${BRAND.name} home`} className="mr-2 text-lg">
          <Logo markClassName="size-7" />
        </Link>
        <nav aria-label="Site" className="hidden items-center gap-1 text-sm lg:flex">
          <div ref={featuresRef} className="relative">
            <button
              type="button"
              aria-expanded={features}
              aria-controls="features-menu"
              onClick={() => setFeatures((f) => !f)}
              className={cn(
                "inline-flex h-10 items-center gap-1 rounded-full px-3 font-medium text-zinc-700 hover:bg-zinc-100",
                (features || active("/features")) && "text-zinc-950",
              )}
            >
              Features <span aria-hidden>▾</span>
            </button>
            {features ? (
              <div
                id="features-menu"
                className="absolute top-12 left-0 grid w-[34rem] grid-cols-2 gap-1 rounded-2xl bg-surface-solid p-2 shadow-xl ring-1 ring-zinc-200"
              >
                {FEATURES.map((f) => (
                  <Link
                    key={f.slug}
                    href={`/features/${f.slug}`}
                    className="flex gap-3 rounded-xl p-3 hover:bg-zinc-50"
                  >
                    <span aria-hidden className="text-xl">
                      {f.icon}
                    </span>
                    <span>
                      <span className="block font-semibold text-zinc-900">{f.name}</span>
                      <span className="block text-xs text-zinc-600">{f.line}</span>
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active(l.href) ? "page" : undefined}
              className={cn(
                "inline-flex h-10 items-center rounded-full px-3 font-medium text-zinc-700 hover:bg-zinc-100",
                active(l.href) && "bg-zinc-100 text-zinc-950",
              )}
            >
              {l.label}
            </Link>
          ))}
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
          <button
            type="button"
            aria-expanded={menu}
            aria-controls="site-menu"
            aria-label={menu ? "Close menu" : "Open menu"}
            onClick={() => setMenu((m) => !m)}
            className="grid size-10 place-items-center rounded-full ring-1 ring-zinc-300 lg:hidden"
          >
            <span aria-hidden className="text-lg leading-none">
              {menu ? "✕" : "☰"}
            </span>
          </button>
        </div>
      </div>
      {menu ? (
        <nav
          id="site-menu"
          aria-label="Site"
          className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-zinc-200 bg-surface-solid px-4 pt-2 pb-6 lg:hidden"
        >
          <p className="px-2 pt-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            Features
          </p>
          <ul className="grid grid-cols-2 gap-1 py-1">
            {FEATURES.map((f) => (
              <li key={f.slug}>
                <Link
                  href={`/features/${f.slug}`}
                  className="flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-medium hover:bg-zinc-50"
                >
                  <span aria-hidden>{f.icon}</span>
                  {f.name}
                </Link>
              </li>
            ))}
          </ul>
          <ul className="mt-2 border-t border-zinc-200 pt-2">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="flex min-h-12 items-center rounded-xl px-2 font-semibold hover:bg-zinc-50"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          {!signedIn ? (
            <Link
              href="/signup"
              className="mt-3 flex h-12 items-center justify-center rounded-full bg-brand-700 font-semibold text-on-brand"
            >
              Start your team
            </Link>
          ) : null}
        </nav>
      ) : null}
    </header>
  );
}
