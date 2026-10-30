import { notFound, redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { playerToday } from "@/lib/player";
import { EventForm } from "@/components/schedule/event-form";
export const metadata = { title: "Edit team event" };
export default async function EditEvent({ params }: PageProps<"/calendar/edit/[id]">) {
  const { id } = await params;
  const { org, isStaff, supabase } = await requireActiveOrg();
  if (!isStaff) redirect("/events");
  const [{ data: event }, { data: groups }, { today }] = await Promise.all([
    supabase.from("team_events").select("*").eq("id", id).eq("org_id", org.id).maybeSingle(),
    supabase.from("player_groups").select("id,name").eq("org_id", org.id).order("name"),
    playerToday(),
  ]);
  if (!event) notFound();
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">Edit team event</h1>
      <EventForm groups={groups ?? []} today={today} initial={event} />
    </div>
  );
}
