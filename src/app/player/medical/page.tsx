import type { Metadata } from "next";
import { requireActiveOrg } from "@/lib/org";
import { MedicalCardEditor } from "@/components/health/medical-page";

export const metadata: Metadata = { title: "Medical card" };

export default async function PlayerMedicalPage() {
  const { supabase, org, user } = await requireActiveOrg();
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">Medical card</h1>
      <MedicalCardEditor supabase={supabase} orgId={org.id} playerId={user.id} firstName="" self />
    </div>
  );
}
