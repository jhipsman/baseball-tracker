import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { NewProgramForm } from "./new-program-form";

export const metadata: Metadata = { title: "New program" };

export default async function NewProgramPage() {
  const { supabase, org, isStaff } = await requireActiveOrg();
  if (!isStaff) redirect("/programs");

  const { data: templates } = await supabase
    .from("programs")
    .select("id, name")
    .eq("org_id", org.id)
    .eq("is_template", true)
    .order("name");

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">New program</h1>
      <NewProgramForm templates={templates ?? []} defaultSeason={org.current_season_phase} />
    </div>
  );
}
