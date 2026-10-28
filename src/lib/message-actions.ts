"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireActiveOrg } from "@/lib/org";
import { hrefForRole } from "@/lib/notifications";
import { dispatchPush } from "@/lib/push";

export type MessageFormState = { error?: string; message?: string; ok?: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (v: FormDataEntryValue | null, max: number) =>
  String(v ?? "")
    .trim()
    .slice(0, max);

function refreshInboxes(threadId?: string) {
  for (const base of ["/messages", "/player/messages", "/parent/messages"]) {
    revalidatePath(base);
    if (threadId) revalidatePath(`${base}/${threadId}`);
  }
}

/** Pushes the notifications our DB triggers just created, after the response is sent. */
function pushSoon() {
  after(() => dispatchPush());
}

export async function postAnnouncement(
  _prev: MessageFormState,
  formData: FormData,
): Promise<MessageFormState> {
  const { supabase, user, org, isStaff } = await requireActiveOrg();
  if (!isStaff) return { error: "Only coaches can post announcements." };
  const title = text(formData.get("title"), 140);
  const body = text(formData.get("body"), 5000);
  const audience = String(formData.get("audience") ?? "team");
  if (!title) return { error: "Give the announcement a title." };
  if (!body) return { error: "Write the announcement." };
  if (audience !== "team" && !UUID.test(audience)) return { error: "Choose who it's for." };

  const { error } = await supabase.from("announcements").insert({
    org_id: org.id,
    author_id: user.id,
    group_id: audience === "team" ? null : audience,
    title,
    body,
    include_parents: formData.get("include_parents") === "on",
    pinned: formData.get("pinned") === "on",
  });
  if (error) return { error: error.message };
  pushSoon();
  refreshInboxes();
  return { message: "Announcement posted.", ok: Date.now() };
}

export async function deleteAnnouncement(id: string): Promise<{ error?: string }> {
  const { supabase, isStaff } = await requireActiveOrg();
  if (!isStaff) return { error: "Only coaches can delete announcements." };
  const { data, error } = await supabase.from("announcements").delete().eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data.length) return { error: "Announcement not found." };
  refreshInboxes();
  return {};
}

export async function setAnnouncementPinned(
  id: string,
  pinned: boolean,
): Promise<{ error?: string }> {
  const { supabase, isStaff } = await requireActiveOrg();
  if (!isStaff) return { error: "Only coaches can pin announcements." };
  const { error } = await supabase.from("announcements").update({ pinned }).eq("id", id);
  if (error) return { error: error.message };
  refreshInboxes();
  return {};
}

/** Starts a conversation (rules are enforced by the start_thread RPC) and opens it. */
export async function startThread(
  _prev: MessageFormState,
  formData: FormData,
): Promise<MessageFormState> {
  const { supabase, org, membership } = await requireActiveOrg();
  const members = [...new Set(formData.getAll("member").map(String))].filter((id) => UUID.test(id));
  const body = text(formData.get("body"), 4000);
  if (!members.length) return { error: "Choose who to message." };
  if (!body) return { error: "Write a message first." };

  const { data: id, error } = await supabase.rpc("start_thread", {
    p_org_id: org.id,
    p_member_ids: members,
    p_subject: text(formData.get("subject"), 140),
    p_body: body,
  });
  if (error) return { error: error.message };
  pushSoon();
  refreshInboxes();
  redirect(hrefForRole(`/messages/${id}`, membership.role));
}

export async function sendMessage(
  _prev: MessageFormState,
  formData: FormData,
): Promise<MessageFormState> {
  const { supabase, user } = await requireActiveOrg();
  const threadId = String(formData.get("thread_id") ?? "");
  const body = text(formData.get("body"), 4000);
  if (!UUID.test(threadId)) return { error: "Conversation not found." };
  if (!body) return { error: "Write a message first." };

  const { error } = await supabase
    .from("thread_messages")
    .insert({ thread_id: threadId, author_id: user.id, body });
  if (error) {
    return {
      error: error.code === "42501" ? "You're not part of this conversation." : error.message,
    };
  }
  pushSoon();
  refreshInboxes(threadId);
  return { ok: Date.now() };
}
