"use server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { dispatchPush } from "@/lib/push";
import { readEvent, readScheduleChange, type ActivityKind } from "@/lib/team-schedule";
import type { FormState } from "@/lib/auth/actions";
import type { Json } from "@/types/database";
function refresh() {
  for (const p of [
    "/calendar",
    "/calendar/manage",
    "/events",
    "/games",
    "/practices",
    "/player",
    "/parent",
  ])
    revalidatePath(p);
}
export async function createTeamEvent(_prev: FormState, fd: FormData): Promise<FormState> {
  const { org, isStaff, supabase } = await requireActiveOrg();
  if (!isStaff) return { error: "Only staff can create events." };
  const read = readEvent(fd);
  if ("error" in read) return read;
  const { data, error } = await supabase.rpc("create_team_events", {
    p_org: org.id,
    p_event: read.event as Json,
    p_count: read.count,
    p_notify: read.notify,
  });
  if (error) return { error: "The event could not be created. Check the group and try again." };
  refresh();
  if (read.notify) after(() => dispatchPush());
  redirect(`/events/event/${data}`);
}
export async function changeSchedule(
  input: unknown,
): Promise<{ error?: string; changed?: number }> {
  const { org, isStaff, supabase } = await requireActiveOrg();
  if (!isStaff) return { error: "Only staff can change the schedule." };
  const read = readScheduleChange(input);
  if ("error" in read) return read;
  const { data, error } = await supabase.rpc("update_schedule_activities", {
    p_org: org.id,
    p_items: read.items as unknown as Json,
    p_action: read.action,
    p_days: read.days,
    p_time: read.time,
    p_location: read.location,
    p_notify: read.notify,
  });
  if (error)
    return {
      error: error.message.includes("schedule changed")
        ? "The schedule changed while you were reviewing it. Refresh, then try again."
        : "Nothing was changed. Check that the selected activities are still available; live or completed games cannot be bulk changed.",
    };
  refresh();
  for (const a of read.items) {
    revalidatePath(`/events/${a.kind}/${a.id}`);
    if (a.kind === "game")
      for (const base of ["/games", "/player/games", "/parent/games"])
        revalidatePath(`${base}/${a.id}`);
    if (a.kind === "practice")
      for (const base of ["/practices", "/player/practices", "/parent/practices"])
        revalidatePath(`${base}/${a.id}`);
  }
  if (read.notify) after(() => dispatchPush());
  return { changed: data };
}
export async function respondToActivity(input: {
  kind: ActivityKind;
  activityId: string;
  playerId: string;
  response?: string;
  checkIn?: boolean;
}): Promise<{ error?: string }> {
  const { org, supabase, isStaff } = await requireActiveOrg();
  const uuid = /^[0-9a-f-]{36}$/i;
  if (
    !input ||
    !["game", "practice", "event"].includes(input.kind) ||
    !uuid.test(input.activityId) ||
    !uuid.test(input.playerId) ||
    (input.response !== undefined &&
      !["yes", "no", "maybe", "unanswered"].includes(input.response)) ||
    (input.checkIn !== undefined && (!isStaff || typeof input.checkIn !== "boolean"))
  )
    return { error: "Choose a valid player and response." };
  const { error } = await supabase.rpc("respond_activity", {
    p_org: org.id,
    p_kind: input.kind,
    p_activity: input.activityId,
    p_player: input.playerId,
    p_response: input.response ?? null,
    p_check_in: input.checkIn ?? null,
  });
  if (error)
    return {
      error:
        "The response could not be saved. Check that this activity is open and the player is on its roster.",
    };
  revalidatePath(`/events/${input.kind}/${input.activityId}`);
  return {};
}

export async function updateTeamEvent(_prev: FormState, fd: FormData): Promise<FormState> {
  const { org, isStaff, supabase } = await requireActiveOrg();
  if (!isStaff) return { error: "Only staff can edit events." };
  const read = readEvent(fd);
  if ("error" in read) return read;
  const id = String(fd.get("event_id") ?? ""),
    updated = String(fd.get("updated_at") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id) || !Number.isFinite(Date.parse(updated)))
    return { error: "Refresh this event before saving." };
  const { error } = await supabase.rpc("edit_team_event", {
    p_org: org.id,
    p_id: id,
    p_updated: updated,
    p_event: read.event as Json,
    p_following: fd.get("following") === "on",
    p_notify: read.notify,
  });
  if (error)
    return {
      error:
        "The event could not be saved. It may have changed while you were editing. Refresh and try again.",
    };
  refresh();
  revalidatePath(`/events/event/${id}`);
  if (read.notify) after(() => dispatchPush());
  redirect(`/events/event/${id}`);
}
export async function loadEventSeries(
  seriesId: string,
): Promise<{ error?: string; activities?: import("@/lib/team-schedule").Activity[] }> {
  const { org, isStaff, supabase } = await requireActiveOrg();
  if (!isStaff || !/^[0-9a-f-]{36}$/i.test(seriesId))
    return { error: "This event series is unavailable." };
  const { data, error } = await supabase
    .from("schedule_activities")
    .select("*")
    .eq("org_id", org.id)
    .eq("kind", "event")
    .eq("series_id", seriesId)
    .order("date")
    .limit(100);
  if (error) return { error: "The series could not be loaded. Try again." };
  return { activities: (data ?? []) as import("@/lib/team-schedule").Activity[] };
}
