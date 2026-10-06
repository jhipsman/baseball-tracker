import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { ExerciseForm } from "../exercise-form";

export const metadata: Metadata = { title: "New exercise" };

export default async function NewExercisePage() {
  const { isStaff } = await requireActiveOrg();
  if (!isStaff) redirect("/exercises");

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">New exercise</h1>
      <p className="mb-6 text-sm text-zinc-600">Custom exercises are only visible to your org.</p>
      <ExerciseForm />
    </div>
  );
}
