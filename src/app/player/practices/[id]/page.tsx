import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { loadPractice } from "@/lib/practices";
import { PracticeView } from "@/components/practice/practice-view";

export const metadata: Metadata = { title: "Practice" };

export default async function PlayerPracticePage({ params }: PageProps<"/player/practices/[id]">) {
  const { id } = await params;
  const { supabase, org, isStaff } = await requireActiveOrg();
  // RLS only returns published plans for the player's team / group.
  const plan = await loadPractice(supabase, id);
  if (!plan || plan.orgId !== org.id || plan.isTemplate || (!plan.published && !isStaff)) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <Link href="/player" className="text-sm text-zinc-500">
        ← Today
      </Link>
      {!plan.published ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Draft preview: players can&apos;t see this until it&apos;s published.
        </p>
      ) : null}
      <PracticeView plan={plan} />
    </div>
  );
}
