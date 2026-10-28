import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { playerToday } from "@/lib/player";
import { formatPracticeDate, loadPractice } from "@/lib/practices";
import { addDays } from "@/lib/schedule";
import { PracticeBuilder } from "@/components/practice/practice-builder";
import {
  DeletePracticeButton,
  DuplicateForm,
  PracticeDetailsForm,
  PublishToggle,
  SaveAsTemplateButton,
} from "@/components/practice/practice-forms";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Practice plan" };

export default async function PracticeBuilderPage({ params }: PageProps<"/practices/[id]">) {
  const { id } = await params;
  const { supabase, org, isStaff } = await requireActiveOrg();
  if (!isStaff) redirect(`/player/practices/${id}`);
  const plan = await loadPractice(supabase, id);
  if (!plan || plan.orgId !== org.id) notFound();
  const { today } = await playerToday();

  const { data: groups } = await supabase
    .from("player_groups")
    .select("id, name")
    .eq("org_id", org.id)
    .order("name");
  const audience = plan.groupName ? `players & parents in ${plan.groupName}` : "the whole team";
  const nextWeek = plan.date && plan.date >= today ? addDays(plan.date, 7) : today;

  return (
    <div className="max-w-6xl">
      <Link
        href={plan.isTemplate ? "/practices?view=templates" : "/practices"}
        className="text-sm text-zinc-500 hover:text-zinc-800"
      >
        ← {plan.isTemplate ? "Templates" : "Practices"}
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{plan.title}</h1>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-semibold",
                plan.isTemplate
                  ? "bg-zinc-100 text-zinc-700"
                  : plan.published
                    ? "bg-brand-50 text-brand-900"
                    : "bg-amber-100 text-amber-900",
              )}
            >
              {plan.isTemplate ? "Template" : plan.published ? "Published" : "Draft"}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-600">
            {[
              plan.date ? formatPracticeDate(plan.date, { weekday: "long", month: "long" }) : null,
              plan.location,
              plan.groupName ? `${plan.groupName} only` : plan.isTemplate ? null : "Whole team",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <Link
          href={`/practices/${plan.id}/print`}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold ring-1 ring-zinc-300 ring-inset hover:bg-zinc-50"
        >
          🖨 Print
        </Link>
      </div>

      <div className="mt-5 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_auto_1fr] lg:gap-x-6">
        <div className="lg:col-start-2 lg:row-start-1">
          {plan.isTemplate ? (
            <div className="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
              <p className="font-semibold">Use this template</p>
              <p className="mb-3 text-xs text-zinc-600">
                Creates a draft practice with these blocks on the date you pick.
              </p>
              <DuplicateForm id={plan.id} defaultDate={today} label="Use on date" />
            </div>
          ) : (
            <PublishToggle
              key={String(plan.published)}
              planId={plan.id}
              published={plan.published}
              audience={audience}
            />
          )}
        </div>

        <div className="lg:col-start-1 lg:row-span-3 lg:row-start-1">
          <PracticeBuilder
            key={plan.id}
            planId={plan.id}
            startTime={plan.startTime}
            initialBlocks={plan.blocks}
          />
        </div>

        <details className="group rounded-xl bg-white ring-1 ring-zinc-200 lg:col-start-2 lg:row-start-2">
          <summary className="flex cursor-pointer items-center justify-between gap-2 p-4 font-semibold">
            Details
            <span className="text-xs font-normal text-zinc-500 group-open:hidden">
              Title, time, location, notes
            </span>
          </summary>
          <div className="border-t border-zinc-100 p-4">
            <PracticeDetailsForm
              id={plan.id}
              template={plan.isTemplate}
              groups={groups ?? []}
              defaults={plan}
            />
          </div>
        </details>

        <div className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-zinc-200 lg:col-start-2 lg:row-start-3">
          <p className="font-semibold">More</p>
          {plan.isTemplate ? null : <DuplicateForm id={plan.id} defaultDate={nextWeek} />}
          {plan.isTemplate ? null : <SaveAsTemplateButton id={plan.id} />}
          <DeletePracticeButton id={plan.id} template={plan.isTemplate} />
        </div>
      </div>
    </div>
  );
}
