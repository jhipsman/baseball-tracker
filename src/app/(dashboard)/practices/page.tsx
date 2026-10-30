import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { playerToday } from "@/lib/player";
import { addDays } from "@/lib/schedule";
import { addStarterPractices } from "@/lib/practice-actions";
import {
  formatDuration,
  formatPracticeDate,
  loadPractices,
  loadPracticeTemplates,
  practiceRange,
  type PracticeSummary,
} from "@/lib/practices";
import { STARTER_PRACTICES } from "@/lib/starter-practices";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Practices" };

const VIEWS = ["upcoming", "past", "templates"] as const;
type View = (typeof VIEWS)[number];

export default async function PracticesPage({ searchParams }: PageProps<"/practices">) {
  const { supabase, org, isStaff } = await requireActiveOrg();
  if (!isStaff) redirect("/player");
  const params = await searchParams;
  const view: View = VIEWS.includes(params.view as View) ? (params.view as View) : "upcoming";
  const { today } = await playerToday();

  const list =
    view === "templates"
      ? await loadPracticeTemplates(supabase, org.id)
      : view === "past"
        ? await loadPractices(supabase, org.id, null, addDays(today, -1), {
            descending: true,
            limit: 100,
          })
        : await loadPractices(supabase, org.id, today, null);

  const missingStarters =
    view === "templates" && STARTER_PRACTICES.some((t) => !list.some((p) => p.title === t.title));

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">Practices</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Plan practices block by block, publish them to the team, and print a dugout copy.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={view === "templates" ? "/practices/new?template=1" : "/practices/new"}
            className="inline-flex h-11 items-center rounded-lg bg-brand-700 px-4 text-sm font-semibold text-on-brand hover:bg-brand-600"
          >
            {view === "templates" ? "New template" : "New practice"}
          </Link>
        </div>
      </div>

      <div className="mt-6 flex gap-1 border-b border-zinc-200">
        {VIEWS.map((v) => (
          <Link
            key={v}
            href={v === "upcoming" ? "/practices" : `/practices?view=${v}`}
            aria-current={v === view ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize",
              v === view
                ? "border-brand-700 text-brand-900"
                : "border-transparent text-zinc-500 hover:text-zinc-800",
            )}
          >
            {v}
          </Link>
        ))}
      </div>

      {missingStarters ? (
        <form
          action={addStarterPractices}
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand-50 p-4 ring-1 ring-brand-100"
        >
          <div>
            <p className="font-medium text-brand-900">Starter practice templates</p>
            <p className="text-sm text-brand-900/80">
              {STARTER_PRACTICES.map((t) => t.title).join(" · ")}
            </p>
          </div>
          <SubmitButton pendingLabel="Adding…">Add templates</SubmitButton>
        </form>
      ) : null}

      {list.length === 0 ? (
        <div className="mt-8 rounded-xl border-2 border-dashed border-zinc-300 p-10 text-center">
          <p className="font-medium">
            {view === "templates"
              ? "No practice templates yet"
              : view === "past"
                ? "No past practices"
                : "No upcoming practices"}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {view === "templates"
              ? "Add the starter templates above, or open any practice and choose “Save as template”."
              : "Create a practice from scratch or start from a template."}
          </p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-100 overflow-hidden rounded-xl bg-surface ring-1 ring-zinc-200">
          {list.map((p) => (
            <PracticeRow key={p.id} p={p} today={today} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PracticeRow({ p, today }: { p: PracticeSummary; today: string }) {
  const range = practiceRange(p.startTime, p.totalMin);
  return (
    <li>
      <Link
        href={`/practices/${p.id}`}
        className="flex items-center gap-4 px-4 py-3 hover:bg-zinc-50"
      >
        {p.date ? (
          <div
            className={cn(
              "flex w-14 shrink-0 flex-col items-center rounded-lg py-1.5 text-center",
              p.date === today ? "bg-brand-700 text-on-brand" : "bg-zinc-100 text-zinc-800",
            )}
          >
            <span className="text-[11px] font-semibold uppercase">
              {formatPracticeDate(p.date, { weekday: "short", month: undefined, day: undefined })}
            </span>
            <span className="text-lg leading-tight font-semibold tabular-nums">
              {Number(p.date.slice(8))}
            </span>
            <span className="text-[10px] uppercase opacity-70">
              {formatPracticeDate(p.date, { weekday: undefined, month: "short", day: undefined })}
            </span>
          </div>
        ) : (
          <span
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xl"
          >
            📋
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{p.title}</p>
          <p className="truncate text-sm text-zinc-600">
            {[
              range ?? (p.isTemplate ? null : "Time TBA"),
              p.totalMin ? formatDuration(p.totalMin) : null,
              `${p.blockCount} block${p.blockCount === 1 ? "" : "s"}`,
              p.location,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {p.groupName ? <p className="text-xs text-zinc-500">{p.groupName} only</p> : null}
        </div>
        {p.isTemplate ? null : (
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
              p.published ? "bg-brand-50 text-brand-900" : "bg-amber-100 text-amber-900",
            )}
          >
            {p.published ? "Published" : "Draft"}
          </span>
        )}
      </Link>
    </li>
  );
}
