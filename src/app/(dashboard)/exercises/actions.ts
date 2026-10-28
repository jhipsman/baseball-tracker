"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/auth/actions";
import { requireActiveOrg } from "@/lib/org";
import { parseDemoVideo } from "@/lib/exercise-video";
import {
  EQUIPMENT,
  EXERCISE_CATEGORIES,
  MUSCLE_GROUPS,
  TRACKING_TYPES,
  type ExerciseCategory,
  type TrackingType,
} from "@/constants";

function pickAllowed(values: FormDataEntryValue[], allowed: readonly string[]) {
  return [...new Set(values.map(String))].filter((v) => allowed.includes(v));
}

export async function saveExercise(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user, org, isStaff } = await requireActiveOrg();
  if (!isStaff) return { error: "Only coaches, trainers, and admins can manage exercises." };

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const instructions = String(formData.get("instructions") ?? "").trim();
  const videoUrl = String(formData.get("video_demo_url") ?? "").trim();
  const trackingType = String(formData.get("tracking_type") ?? "weight_reps");
  const muscleGroups = pickAllowed(formData.getAll("muscle_groups"), MUSCLE_GROUPS);
  const equipment = pickAllowed(formData.getAll("equipment"), EQUIPMENT);

  if (!name) return { error: "Name is required." };
  if (!(EXERCISE_CATEGORIES as readonly string[]).includes(category)) {
    return { error: "Choose a category." };
  }
  if (!(TRACKING_TYPES as readonly string[]).includes(trackingType)) {
    return { error: "Choose how the exercise is tracked." };
  }
  // Only links we can turn into a safe embed are stored (see lib/exercise-video).
  if (videoUrl && !parseDemoVideo(videoUrl)) {
    return {
      error:
        "Demo video link must be a YouTube or Vimeo video link (or an https link to an .mp4 file).",
    };
  }

  const fields = {
    name,
    category: category as ExerciseCategory,
    description: description || null,
    instructions: instructions || null,
    video_demo_url: videoUrl || null,
    tracking_type: trackingType as TrackingType,
    muscle_groups: muscleGroups,
    equipment,
  };

  const { error } = id
    ? await supabase.from("exercises").update(fields).eq("id", id).eq("org_id", org.id)
    : await supabase
        .from("exercises")
        .insert({ ...fields, org_id: org.id, is_custom: true, created_by: user.id });

  if (error) {
    if (error.code === "23505") return { error: `Your library already has "${name}".` };
    return { error: error.message };
  }

  revalidatePath("/exercises");
  redirect("/exercises?category=" + category);
}

export async function deleteExercise(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, org } = await requireActiveOrg();
  const { error } = await supabase
    .from("exercises")
    .delete()
    .eq("id", String(formData.get("id")))
    .eq("org_id", org.id);

  if (error) {
    if (error.code === "23503") {
      return { error: "This exercise is used in a program. Remove it from those programs first." };
    }
    return { error: error.message };
  }

  revalidatePath("/exercises");
  redirect("/exercises");
}
