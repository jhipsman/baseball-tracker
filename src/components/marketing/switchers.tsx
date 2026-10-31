"use client";

import { useState } from "react";
import Link from "next/link";
import { AUDIENCES, FEATURES } from "./content";
import { cn } from "@/lib/utils";

/** "Who's it for?" — pick coach, player or parent and see just that. */
export function AudienceSwitch() {
  const [pick, setPick] = useState(0);
  const a = AUDIENCES[pick];
  const Mock = a.jobs[0].Mock;
  return (
    <section aria-labelledby="who" className="mx-auto max-w-6xl px-4 py-14">
      <h2 id="who" className="text-center text-3xl font-semibold tracking-tight">
        Who&apos;s it for?
      </h2>
      <div
        role="tablist"
        aria-label="Who's it for"
        className="mx-auto mt-5 flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-surface p-1 ring-1 ring-zinc-200"
      >
        {AUDIENCES.map((x, i) => (
          <button
            key={x.slug}
            role="tab"
            id={`aud-${x.slug}`}
            aria-selected={pick === i}
            aria-controls="aud-panel"
            onClick={() => setPick(i)}
            className={cn(
              "h-11 shrink-0 rounded-full px-4 text-sm font-semibold sm:px-5",
              pick === i ? "bg-zinc-900 text-zinc-50" : "text-zinc-700 hover:bg-zinc-100",
            )}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div
        id="aud-panel"
        role="tabpanel"
        aria-labelledby={`aud-${a.slug}`}
        className="mt-10 grid items-center gap-8 md:grid-cols-2 md:gap-14"
      >
        <div>
          <h3 className="text-3xl font-semibold tracking-tight text-balance">{a.title}</h3>
          <p className="mt-3 text-lg text-zinc-600">{a.lead}</p>
          <ul className="mt-5 space-y-3">
            {a.jobs.map((j) => (
              <li key={j.title} className="flex gap-3">
                <span aria-hidden className="mt-0.5 font-bold text-brand-600">
                  ✓
                </span>
                <span>
                  <b className="block">{j.title}</b>
                  <span className="text-zinc-600">{j.text}</span>
                </span>
              </li>
            ))}
          </ul>
          <Link
            href={`/for/${a.slug}`}
            className="mt-6 inline-flex min-h-11 items-center font-semibold text-brand-700 hover:underline"
          >
            Everything for {a.label.toLowerCase()} →
          </Link>
        </div>
        <div className="mx-auto w-full max-w-md">
          <Mock />
        </div>
      </div>
    </section>
  );
}

/** One feature at a time, so the page stays short. */
export function FeatureTabs() {
  const [pick, setPick] = useState(0);
  const f = FEATURES[pick];
  return (
    <section aria-labelledby="inside" className="py-14">
      <div className="mx-auto max-w-6xl px-4">
        <h2 id="inside" className="text-center text-3xl font-semibold tracking-tight">
          What&apos;s inside
        </h2>
        <div
          role="tablist"
          aria-label="Features"
          className="mt-5 flex gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:justify-center"
        >
          {FEATURES.map((x, i) => (
            <button
              key={x.slug}
              role="tab"
              id={`ft-${x.slug}`}
              aria-selected={pick === i}
              aria-controls="ft-panel"
              onClick={() => setPick(i)}
              className={cn(
                "inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold ring-1",
                pick === i
                  ? "bg-brand-700 text-on-brand ring-brand-700"
                  : "bg-surface text-zinc-700 ring-zinc-200 hover:bg-zinc-50",
              )}
            >
              <span aria-hidden>{x.icon}</span>
              {x.name}
            </button>
          ))}
        </div>
        <div
          id="ft-panel"
          role="tabpanel"
          aria-labelledby={`ft-${f.slug}`}
          className="mt-8 grid items-center gap-8 md:grid-cols-2 md:gap-14"
        >
          <div>
            <h3 className="text-3xl font-semibold tracking-tight text-balance">{f.title}</h3>
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
            <Link
              href={`/features/${f.slug}`}
              className="mt-5 inline-flex min-h-11 items-center font-semibold text-brand-700 hover:underline"
            >
              More about {f.name.toLowerCase()} →
            </Link>
          </div>
          <div className="mx-auto w-full max-w-md">
            <f.Mock />
          </div>
        </div>
      </div>
    </section>
  );
}
