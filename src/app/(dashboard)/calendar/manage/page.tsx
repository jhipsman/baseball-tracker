import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { playerToday } from "@/lib/player";
import { addDays } from "@/lib/schedule";
import { normalizeDate } from "@/lib/imports/parse";
import { loadActivities } from "@/lib/team-schedule";
import { ActivityManager } from "@/components/schedule/activity-manager";
import { buttonClass } from "@/components/ui/button";
export const metadata = { title: "Manage schedule" };
export default async function ManageSchedule({ searchParams }: PageProps<"/calendar/manage">) {
  const { org, supabase, isStaff } = await requireActiveOrg();
  if (!isStaff) redirect("/events");
  const params = await searchParams;
  const { today } = await playerToday();
  const from = normalizeDate(String(params.from ?? "")) ?? today;
  let to = normalizeDate(String(params.to ?? "")) ?? addDays(from, 30);
  if (to < from || to > addDays(from, 93)) to = addDays(from, 30);
  const [activities, { data: groups }] = await Promise.all([
    loadActivities(supabase, org.id, from, to),
    supabase.from("player_groups").select("id,name").eq("org_id", org.id).order("name"),
  ]);
  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">Manage schedule</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Games, practices, and team events. Review changes before notifying families.
          </p>
        </div>
        <Link href="/calendar/new" className={buttonClass()}>
          Create team event
        </Link>
      </div>
      <form action="/calendar/manage" className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          From
          <input
            aria-label="From date"
            name="from"
            type="date"
            defaultValue={from}
            className="block h-11 rounded-lg bg-surface px-3 ring-1 ring-zinc-300"
          />
        </label>
        <label className="space-y-1 text-sm">
          Through
          <input
            aria-label="Through date"
            name="to"
            type="date"
            defaultValue={to}
            min={from}
            max={addDays(from, 93)}
            className="block h-11 rounded-lg bg-surface px-3 ring-1 ring-zinc-300"
          />
        </label>
        <button className={buttonClass("secondary")}>Show dates</button>
        <Link href="/calendar" className={buttonClass("ghost")}>
          Week / month calendar
        </Link>
      </form>
      <ActivityManager activities={activities} groups={groups ?? []} />
      {activities.length === 1000 && (
        <p className="text-sm text-amber-800">
          Showing 1,000 activities. Choose a shorter date range to see all results.
        </p>
      )}
    </div>
  );
}
