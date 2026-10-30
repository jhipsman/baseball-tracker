import Link from "next/link";
import { requireActiveOrg } from "@/lib/org";
import { playerToday } from "@/lib/player";
import { addDays } from "@/lib/schedule";
import { loadActivities } from "@/lib/team-schedule";
export const metadata = { title: "Team activities" };
export default async function TeamActivities() {
  const { org, supabase, membership, isStaff } = await requireActiveOrg();
  const { today } = await playerToday();
  const activities = await loadActivities(supabase, org.id, addDays(today, -7), addDays(today, 90));
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Link
        className="text-sm text-brand-700"
        href={
          isStaff
            ? "/calendar"
            : membership.role === "parent"
              ? "/parent/schedule"
              : "/player/games"
        }
      >
        ← Schedule
      </Link>
      <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">Team activities</h1>
      <p className="text-sm text-zinc-600">
        Open an activity to RSVP, see your team’s plans, or check in.
      </p>
      {activities.map((a) => (
        <Link
          key={a.kind + a.id}
          href={`/events/${a.kind}/${a.id}`}
          className="block rounded-xl bg-surface p-5 ring-1 ring-zinc-200"
        >
          <strong>{a.title}</strong>
          <span className="mt-1 block text-sm text-zinc-600">
            {a.date} · {a.start_time?.slice(0, 5) ?? "Time not set"} ·{" "}
            {a.location ?? "Location not set"} · {a.state}
          </span>
        </Link>
      ))}
      {!activities.length && (
        <p className="text-sm text-zinc-600">No team activities have been shared yet.</p>
      )}
    </main>
  );
}
