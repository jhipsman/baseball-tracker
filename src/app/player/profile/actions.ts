"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/auth/actions";
import { requireUser } from "@/lib/org";

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const fullName = String(formData.get("full_name") ?? "")
    .trim()
    .slice(0, 120);
  if (!fullName) return { error: "Name is required." };

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", user.id);
  if (error) return { error: error.message };
  await supabase.auth.updateUser({ data: { full_name: fullName } });
  revalidatePath("/player", "layout");
  return { message: "Saved." };
}
