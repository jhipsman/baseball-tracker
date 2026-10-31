import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { parseContacts } from "@/lib/medical";
import { MedicalForm } from "./medical-form";

/** The family's medical card page body (player or parent view). */
export async function MedicalCardEditor({
  supabase,
  orgId,
  playerId,
  firstName,
  self,
}: {
  supabase: SupabaseClient<Database>;
  orgId: string;
  playerId: string;
  firstName: string;
  self: boolean;
}) {
  const { data } = await supabase
    .from("player_medical")
    .select("allergies, medications, conditions, contacts")
    .eq("org_id", orgId)
    .eq("player_id", playerId)
    .maybeSingle();
  return (
    <section className="space-y-4 rounded-2xl bg-surface p-4 ring-1 ring-zinc-200 sm:p-5">
      <p className="text-sm text-zinc-600">
        {self ? "Your" : `${firstName}'s`} coaches see this card on game day so they can act fast
        and reach {self ? "your family" : "you"}. Only the team&apos;s coaches,{" "}
        {self ? "you and your parents" : `${firstName} and their parents`} can see it.
      </p>
      <MedicalForm
        playerId={playerId}
        firstName={self ? "you" : firstName}
        initial={{
          allergies: data?.allergies ?? "",
          medications: data?.medications ?? "",
          conditions: data?.conditions ?? "",
          contacts: parseContacts(data?.contacts),
        }}
      />
    </section>
  );
}
