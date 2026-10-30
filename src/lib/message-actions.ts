"use server";

import { audienceFingerprint } from "@/lib/announcement-audience";
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

  const { data: recipients, error: audienceError } = await supabase.rpc("announcement_recipients", {
    p_org: org.id,
    p_group: audience === "team" ? null : audience,
    p_parents: formData.get("include_parents") === "on",
    p_scope: String(formData.get("scope") ?? "audience"),
  });
  if (audienceError || !recipients?.length)
    return { error: "No recipients match this audience. Check the group and parent selection." };
  if (recipients.length > 500) return { error: "Choose a smaller group (up to 500 recipients)." };
  const recipientIds = recipients.map((r) => r.profile_id);
  if (audienceFingerprint(recipientIds) !== formData.get("audience_fingerprint"))
    return { error: "Review the recipients again before posting; the audience may have changed." };
  const { error } = await supabase.from("announcements").insert({
    org_id: org.id,
    recipient_ids: recipientIds,
    audience_scope: String(formData.get("scope") ?? "audience"),
    author_id: user.id,
    group_id: audience === "team" ? null : audience,
    title,
    body,
    include_parents: formData.get("include_parents") === "on",
    pinned: formData.get("pinned") === "on",
  });
  if (error)
    return { error: "The announcement did not post. Your text is still here; please try again." };
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

export async function previewAnnouncement(input: {
  audience: string;
  parents: boolean;
  scope: string;
}): Promise<{
  error?: string;
  fingerprint?: string;
  recipients?: { profile_id: string; display_name: string }[];
}> {
  const { supabase, org, isStaff } = await requireActiveOrg();
  if (
    !isStaff ||
    !input ||
    (input.audience !== "team" && !UUID.test(input.audience)) ||
    typeof input.parents !== "boolean" ||
    !["audience", "overdue"].includes(input.scope)
  )
    return { error: "Choose who should see this announcement." };
  const { data, error } = await supabase.rpc("announcement_recipients", {
    p_org: org.id,
    p_group: input.audience === "team" ? null : input.audience,
    p_parents: input.parents,
    p_scope: input.scope,
  });
  if (error)
    return { error: "This audience could not be loaded. Only admins can select overdue payers." };
  if (!data?.length) return { error: "No recipients match this audience." };
  if (data.length > 500) return { error: "Choose a smaller group (up to 500 recipients)." };
  return { fingerprint: audienceFingerprint(data.map((r) => r.profile_id)), recipients: data };
}
export async function saveMessageTemplate(input: {
  title: string;
  body: string;
}): Promise<{ error?: string; id?: string }> {
  const { supabase, org, user, isStaff } = await requireActiveOrg();
  if (!isStaff) return { error: "Only staff can save templates." };
  if (
    !input ||
    typeof input.title !== "string" ||
    typeof input.body !== "string" ||
    !input.title.trim() ||
    !input.body.trim() ||
    input.title.length > 140 ||
    input.body.length > 5000
  )
    return { error: "Write a title and message before saving a template." };
  const { data, error } = await supabase
    .from("message_templates")
    .insert({
      org_id: org.id,
      title: input.title.trim(),
      body: input.body.trim(),
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return { error: "Template could not be saved. Please try again." };
  revalidatePath("/messages");
  return { id: data.id };
}
