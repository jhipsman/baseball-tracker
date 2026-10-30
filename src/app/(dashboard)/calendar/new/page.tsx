import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { playerToday } from "@/lib/player";
import { EventForm } from "@/components/schedule/event-form";
export const metadata = { title: "Create team event" };
export default async function NewEvent() {
  const { isStaff, org, supabase } = await requireActiveOrg();
  if (!isStaff) redirect("/events");
  const [{ today }, { data: groups }] = await Promise.all([
    playerToday(),
    supabase.from("player_groups").select("id,name").eq("org_id", org.id).order("name"),
  ]);
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">Create team event</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Meetings, training, tryouts, and other team activities.
        </p>
      </div>
      <EventForm groups={groups ?? []} today={today} />
    </div>
  );
}
