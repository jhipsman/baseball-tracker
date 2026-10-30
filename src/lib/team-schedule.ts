import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { addDays } from "@/lib/schedule";
import { normalizeDate, normalizeTime } from "@/lib/imports/parse";
export type ActivityKind = "game" | "practice" | "event";
export type Activity = {
  id: string;
  org_id: string;
  kind: ActivityKind;
  group_id: string | null;
  title: string;
  date: string;
  start_time: string | null;
  duration_minutes: number;
  location: string | null;
  published: boolean;
  state: string;
  updated_at: string;
  series_id: string | null;
};
export type ActivityRef = { id: string; kind: ActivityKind; updatedAt: string };
export type ScheduleChange = {
  items: ActivityRef[];
  action: "reschedule" | "cancel" | "restore" | "delete";
  days: number;
  time: string | null;
  location: string | null;
  notify: boolean;
};
export const activityKey = (a: Pick<Activity, "id" | "kind">) => `${a.kind}:${a.id}`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function readScheduleChange(input: unknown): ScheduleChange | { error: string } {
  if (!input || typeof input !== "object") return { error: "Choose the activities to change." };
  const v = input as ScheduleChange;
  if (
    !["reschedule", "cancel", "restore", "delete"].includes(v.action) ||
    !Array.isArray(v.items) ||
    v.items.length < 1 ||
    v.items.length > 100
  )
    return { error: "Select between 1 and 100 activities and choose an action." };
  if (!Number.isInteger(v.days) || Math.abs(v.days) > 365)
    return { error: "Move dates by up to 365 days." };
  if (v.time !== null && (typeof v.time !== "string" || normalizeTime(v.time) === null))
    return { error: "Choose a valid start time." };
  if (v.location !== null && (typeof v.location !== "string" || v.location.length > 200))
    return { error: "Use a location under 200 characters." };
  if (
    typeof v.notify !== "boolean" ||
    v.items.some(
      (i) =>
        !i ||
        !UUID.test(i.id) ||
        !["game", "practice", "event"].includes(i.kind) ||
        typeof i.updatedAt !== "string" ||
        !Number.isFinite(Date.parse(i.updatedAt)),
    )
  )
    return { error: "The activity selection is invalid. Refresh and try again." };
  if (new Set(v.items.map(activityKey)).size !== v.items.length)
    return { error: "An activity was selected twice." };
  return {
    ...v,
    time: v.time === null ? null : normalizeTime(v.time),
    location: v.location?.trim() ?? null,
  };
}
export function previewScheduleChange(activities: Activity[], change: ScheduleChange): Activity[] {
  const selected = new Set(change.items.map(activityKey));
  return activities.map((a) =>
    !selected.has(activityKey(a))
      ? a
      : {
          ...a,
          date: change.action === "reschedule" ? addDays(a.date, change.days) : a.date,
          start_time:
            change.action === "reschedule" && change.time !== null
              ? change.time || null
              : a.start_time,
          location:
            change.action === "reschedule" && change.location !== null
              ? change.location || null
              : a.location,
          state:
            change.action === "cancel" || change.action === "delete"
              ? "canceled"
              : change.action === "restore"
                ? "scheduled"
                : a.state,
        },
  );
}
/** Conflicts are advisory: teams can deliberately share a field. Compare floating local schedule times, not time zones. */
export function scheduleConflicts(
  activities: Activity[],
): { first: string; second: string; location: string }[] {
  const booked = activities.filter(
    (a) =>
      a.location?.trim() &&
      a.start_time &&
      a.published &&
      !["canceled", "postponed"].includes(a.state),
  );
  const result: { first: string; second: string; location: string }[] = [];
  for (let i = 0; i < booked.length; i++)
    for (let j = i + 1; j < booked.length; j++) {
      const a = booked[i],
        b = booked[j];
      if (a.location!.trim().toLowerCase() !== b.location!.trim().toLowerCase()) continue;
      const minute = (r: Activity) =>
        Date.parse(r.date + "T00:00:00Z") / 60000 +
        Number(r.start_time!.slice(0, 2)) * 60 +
        Number(r.start_time!.slice(3, 5));
      const startA = minute(a),
        startB = minute(b);
      if (startA < startB + b.duration_minutes && startB < startA + a.duration_minutes)
        result.push({ first: activityKey(a), second: activityKey(b), location: a.location! });
    }
  return result;
}
export function readEvent(fd: FormData) {
  const text = (key: string) => String(fd.get(key) ?? "").trim();
  const title = text("title"),
    date = normalizeDate(text("date")),
    time = normalizeTime(text("start_time"));
  const count = Number(text("count") || 1),
    duration = Number(text("duration_minutes") || 60),
    group = text("group_id"),
    type = text("event_type") || "other";
  if (!title || title.length > 120)
    return { error: "Give the event a title under 120 characters." } as const;
  if (!date || time === null) return { error: "Choose a valid date and start time." } as const;
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > 26 ||
    !Number.isInteger(duration) ||
    duration < 1 ||
    duration > 720
  )
    return {
      error: "Choose 1–26 weekly occurrences and a duration between 1 and 720 minutes.",
    } as const;
  if (group && !UUID.test(group)) return { error: "Choose a valid group." } as const;
  if (
    !["meeting", "training", "tryout", "social", "other"].includes(type) ||
    text("location").length > 200 ||
    text("notes").length > 4000
  )
    return { error: "Check the event type, location and notes." } as const;
  return {
    event: {
      title,
      date,
      start_time: time,
      group_id: group || null,
      event_type: type,
      duration_minutes: duration,
      location: text("location") || null,
      notes: text("notes") || null,
      published: fd.get("published") === "on",
    },
    count,
    notify: fd.get("notify") === "on",
  };
}
export async function loadActivities(
  client: SupabaseClient<Database>,
  orgId: string,
  from: string,
  to: string,
) {
  const { data, error } = await client
    .from("schedule_activities")
    .select("*")
    .eq("org_id", orgId)
    .gte("date", from)
    .lte("date", to)
    .order("date")
    .order("start_time")
    .limit(1000);
  if (error) throw new Error("The team schedule could not be loaded.");
  return (data ?? []) as Activity[];
}
