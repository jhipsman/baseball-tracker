import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { loadPractice } from "@/lib/practices";
import { PracticeView } from "@/components/practice/practice-view";

export const metadata: Metadata = { title: "Practice" };

export default async function ParentPracticePage({ params }: PageProps<"/parent/practices/[id]">) {
  const { id } = await params;
  const { supabase, org } = await requireActiveOrg();
  // RLS only returns published plans for the whole team or a linked child's group.
  const plan = await loadPractice(supabase, id);
  if (!plan || plan.orgId !== org.id || plan.isTemplate || !plan.published) notFound();

  return (
    <div className="space-y-4">
      <Link href="/parent" className="text-sm text-zinc-500">
        ← Home
      </Link>
      <PracticeView plan={plan} />
    </div>
  );
}
