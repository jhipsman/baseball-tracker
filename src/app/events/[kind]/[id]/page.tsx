import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { requireParent } from "@/lib/parent";
import { Attendance } from "@/components/schedule/attendance";
import { buttonClass } from "@/components/ui/button";
import type { ActivityKind } from "@/lib/team-schedule";
export const metadata = { title: "Team activity" };
export default async function ActivityPage({ params }: PageProps<"/events/[kind]/[id]">) {
  const { kind, id } = await params;
  if (!["game", "practice", "event"].includes(kind) || !/^\w{8}-[\w-]{27}$/.test(id)) notFound();
  const { org, supabase, user, membership, isStaff } = await requireActiveOrg();
  const { data: a } = await supabase
    .from("schedule_activities")
    .select("*")
    .eq("id", id)
    .eq("kind", kind)
    .eq("org_id", org.id)
    .maybeSingle();
  if (!a) notFound();
  let eligibleIds: string[] | null = null;
  if (!isStaff) {
    eligibleIds =
      membership.role === "parent" ? (await requireParent()).children.map((c) => c.id) : [user.id];
  }
  const [{ data: members }, { data: attendance }, { data: groupMembers }] = await Promise.all([
    supabase
      .from("org_memberships")
      .select("profile_id,profile:profiles(full_name,email)")
      .eq("org_id", org.id)
      .eq("role", "player"),
    supabase
      .from("activity_attendance")
      .select("player_id,response,checked_in")
      .eq("org_id", org.id)
      .eq("kind", kind)
      .eq("activity_id", id),
    a.group_id
      ? supabase.from("player_group_members").select("profile_id").eq("group_id", a.group_id)
      : Promise.resolve({ data: null }),
  ]);
  const players = (members ?? [])
    .filter(
      (m) =>
        (!eligibleIds || eligibleIds.includes(m.profile_id)) &&
        (!groupMembers || groupMembers.some((g) => g.profile_id === m.profile_id)),
    )
    .map((m) => {
      const r = attendance?.find((r) => r.player_id === m.profile_id);
      return {
        id: m.profile_id,
        name: m.profile.full_name || m.profile.email,
        response: r?.response ?? "unanswered",
        checkedIn: r?.checked_in ?? false,
      };
    });
  const { data: event } =
    kind === "event"
      ? await supabase
          .from("team_events")
          .select("notes,event_type")
          .eq("id", id)
          .eq("org_id", org.id)
          .single()
      : { data: null };
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Link href={isStaff ? "/calendar/manage" : "/events"} className="text-sm text-brand-700">
        ← Team schedule
      </Link>
      <header>
        <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">{a.title}</h1>
        <p className="mt-2 text-sm text-zinc-600">
          {a.date} · {a.start_time?.slice(0, 5) ?? "Time not set"} ·{" "}
          {a.location ?? "Location not set"} · {a.state}
        </p>
      </header>
      {isStaff && kind === "event" && (
        <Link href={`/calendar/edit/${id}`} className={buttonClass("secondary")}>
          Edit event / series
        </Link>
      )}
      {event?.notes && (
        <p className="rounded-xl bg-surface p-5 text-sm whitespace-pre-wrap ring-1 ring-zinc-200">
          {event.notes}
        </p>
      )}
      {kind !== "event" && (
        <Link
          className={buttonClass("secondary")}
          href={
            kind === "game"
              ? `${isStaff ? "" : membership.role === "parent" ? "/parent" : "/player"}/games/${id}`
              : `${isStaff ? "" : membership.role === "parent" ? "/parent" : "/player"}/practices/${id}`
          }
        >
          Open {kind === "game" ? "game & score" : "practice plan"}
        </Link>
      )}
      <Attendance
        kind={kind as ActivityKind}
        activityId={id}
        staff={isStaff}
        players={players}
        closed={["canceled", "postponed"].includes(a.state) || !a.published}
      />
    </main>
  );
}
