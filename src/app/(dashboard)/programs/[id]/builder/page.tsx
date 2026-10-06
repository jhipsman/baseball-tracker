import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { WorkoutBuilder } from "@/components/workout-builder/builder";
import { requireActiveOrg } from "@/lib/org";
import { loadProgramTree, toBuilderWeeks } from "@/lib/programs";
import { saveProgramStructure } from "./actions";

export const metadata: Metadata = { title: "Workout builder" };

export default async function BuilderPage({ params }: PageProps<"/programs/[id]/builder">) {
  const { id } = await params;
  const { supabase, isStaff, org } = await requireActiveOrg();
  if (!isStaff) redirect(`/programs/${id}`);

  const [program, { data: library, error }] = await Promise.all([
    loadProgramTree(supabase, id),
    supabase
      .from("exercises")
      .select("id, name, category, muscle_groups, equipment, is_custom")
      .order("name"),
  ]);
  if (error) throw error;
  if (!program || program.org_id !== org.id) notFound();

  return (
    <WorkoutBuilder
      key={program.id}
      programId={program.id}
      programName={program.name}
      initialWeeks={toBuilderWeeks(program)}
      library={library}
      save={saveProgramStructure}
    />
  );
}
