"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/org";
import { isNotificationKind } from "@/lib/notifications";

export async function markAllNotificationsRead(): Promise<void> {
  const { supabase, user } = await requireUser();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("profile_id", user.id)
    .is("read_at", null);
  revalidatePath("/", "layout");
}

export type PushSubscriptionInput = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

/** Saves this browser's push subscription for the signed-in user. */
export async function savePushSubscription(
  sub: PushSubscriptionInput,
  userAgent: string,
): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  const endpoint = String(sub?.endpoint ?? "");
  const p256dh = String(sub?.keys?.p256dh ?? "");
  const auth = String(sub?.keys?.auth ?? "");
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000 || !p256dh || !auth) {
    return { error: "This browser returned an invalid subscription." };
  }
  // The endpoint is unique; if this browser was registered to someone else, replace it.
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      profile_id: user.id,
      endpoint,
      p256dh: p256dh.slice(0, 200),
      auth: auth.slice(0, 100),
      user_agent: String(userAgent ?? "").slice(0, 300) || null,
    },
    { onConflict: "endpoint" },
  );
  if (error) {
    return {
      error:
        error.code === "23505" || error.code === "42501"
          ? "This device is registered to another account. Sign out there first."
          : error.message,
    };
  }
  return {};
}

export async function deletePushSubscription(endpoint: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("profile_id", user.id)
    .eq("endpoint", String(endpoint ?? ""));
  return error ? { error: error.message } : {};
}

/** Saves which kinds are muted for push. The form sends the kinds that stay ON. */
export async function savePushPreferences(
  _prev: { error?: string; message?: string },
  formData: FormData,
): Promise<{ error?: string; message?: string }> {
  const { supabase, user } = await requireUser();
  const shown = formData.getAll("shown").map(String).filter(isNotificationKind);
  const on = new Set(formData.getAll("on").map(String));
  const { data: profile } = await supabase
    .from("profiles")
    .select("push_muted")
    .eq("id", user.id)
    .single();
  // Kinds not shown to this role keep their previous setting.
  const muted = new Set((profile?.push_muted ?? []).filter((k) => !shown.includes(k as never)));
  for (const k of shown) if (!on.has(k)) muted.add(k);
  const { error } = await supabase
    .from("profiles")
    .update({ push_muted: [...muted].sort() })
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/notifications");
  return { message: "Saved." };
}
