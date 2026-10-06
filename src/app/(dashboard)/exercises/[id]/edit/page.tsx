import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { ExerciseForm } from "../../exercise-form";

export const metadata: Metadata = { title: "Edit exercise" };

export default async function EditExercisePage({ params }: PageProps<"/exercises/[id]/edit">) {
  const { id } = await params;
  const { supabase, org, isStaff } = await requireActiveOrg();
  if (!isStaff) redirect("/exercises");

  const { data: exercise } = await supabase
    .from("exercises")
    .select("*")
    .eq("id", id)
    .eq("org_id", org.id)
    .maybeSingle();
  if (!exercise) notFound();

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Edit {exercise.name}</h1>
      <ExerciseForm exercise={exercise} />
    </div>
  );
}
