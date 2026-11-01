import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { TRAINING_SOURCES } from "@/lib/ask-9d";
import { AskForm } from "./ask-form";

export const metadata: Metadata = { title: "Ask 9D" };

export default async function AskPage() {
  const { membership } = await requireActiveOrg();
  if (membership.role !== "player") redirect("/player");
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">Ask 9D</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Explore baseball training with source-backed explanations and questions to discuss with
          your coach.
        </p>
      </header>
      <p className="rounded-xl bg-surface p-3 text-sm text-zinc-600 ring-1 ring-zinc-200">
        Early preview: hitting fundamentals and pitching-workload education. This is a curated
        reading library, not live web or video search.
      </p>
      <AskForm />
      <section className="space-y-3">
        <h2 className="font-semibold">Browse the source library</h2>
        {TRAINING_SOURCES.map((source) => (
          <a
            key={source.id}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl bg-surface p-4 ring-1 ring-zinc-200"
          >
            <p className="text-xs text-zinc-600">{source.publisher}</p>
            <p className="mt-1 font-medium text-brand-700 underline">{source.title} ↗</p>
          </a>
        ))}
      </section>
    </div>
  );
}
