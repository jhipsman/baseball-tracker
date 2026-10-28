import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { playerToday } from "@/lib/player";
import { formatDuration, loadPracticeTemplates } from "@/lib/practices";
import { NewPracticeForm } from "@/components/practice/practice-forms";

export const metadata: Metadata = { title: "New practice" };

export default async function NewPracticePage({ searchParams }: PageProps<"/practices/new">) {
  const { supabase, org, isStaff } = await requireActiveOrg();
  if (!isStaff) redirect("/player");
  const params = await searchParams;
  const asTemplate = params.template === "1";
  const from = typeof params.from === "string" ? params.from : undefined;
  const { today } = await playerToday();

  const [templates, { data: groups }] = await Promise.all([
    loadPracticeTemplates(supabase, org.id),
    supabase.from("player_groups").select("id, name").eq("org_id", org.id).order("name"),
  ]);

  return (
    <div className="max-w-xl">
      <Link
        href={asTemplate ? "/practices?view=templates" : "/practices"}
        className="text-sm text-zinc-500 hover:text-zinc-800"
      >
        ← Practices
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        {asTemplate ? "New practice template" : "New practice"}
      </h1>
      <p className="mt-1 text-sm text-zinc-600">
        {asTemplate
          ? "Templates have no date. Use them to start new practices quickly."
          : "Set the basics, then add blocks in the builder. It stays a draft until you publish it."}
      </p>
      <div className="mt-6 rounded-xl bg-white p-5 ring-1 ring-zinc-200">
        <NewPracticeForm
          groups={groups ?? []}
          today={today}
          asTemplate={asTemplate}
          initialTemplate={templates.some((t) => t.id === from) ? from : undefined}
          templates={templates.map((t) => ({
            id: t.id,
            title: t.title,
            summary: `${t.blockCount} blocks, ${formatDuration(t.totalMin)}`,
          }))}
        />
      </div>
    </div>
  );
}
