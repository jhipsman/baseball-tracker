import "server-only";

import { createClient } from "@supabase/supabase-js";
import webpush, { WebPushError } from "web-push";
import type { Database } from "@/types/database";
import { hrefForRole } from "@/lib/notifications";

/** Notifications older than this are never pushed (they were seen in-app or are stale). */
const WINDOW_MS = 15 * 60 * 1000;

type PushConfig = {
  url: string;
  secret: string;
  publicKey: string;
  privateKey: string;
  subject: string;
};

function pushConfig(): PushConfig | null {
  const env = process.env;
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = env.SUPABASE_SECRET_KEY?.trim();
  const publicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  if (!url || !secret || !publicKey || !privateKey) return null;
  const site =
    env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  const subject =
    env.VAPID_SUBJECT?.trim() ||
    (site.startsWith("https://")
      ? site
      : `mailto:admin@${site.replace(/^\w+:\/\//, "") || "localhost"}`);
  return { url, secret, publicKey, privateKey, subject };
}

/** True when push delivery is configured on the server. */
export function pushEnabled() {
  return pushConfig() !== null;
}

export type DispatchResult = { sent: number; failed: number; removed: number; skipped?: string };

/**
 * Sends web push for recent notifications that haven't been pushed yet.
 * Safe to call often (e.g. `after(() => dispatchPush())` at the end of a server action):
 * it claims rows by setting `pushed_at` before sending, skips kinds the recipient muted,
 * links to the page for the recipient's role, and removes expired subscriptions.
 * A no-op when SUPABASE_SECRET_KEY or the VAPID keys aren't set. Never throws.
 */
export async function dispatchPush(): Promise<DispatchResult> {
  const cfg = pushConfig();
  if (!cfg) return { sent: 0, failed: 0, removed: 0, skipped: "not configured" };

  try {
    const admin = createClient<Database>(cfg.url, cfg.secret, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const since = new Date(Date.now() - WINDOW_MS).toISOString();

    const { data: pending, error } = await admin
      .from("notifications")
      .select("id")
      .is("pushed_at", null)
      .gte("created_at", since)
      .order("created_at")
      .limit(500);
    if (error) throw error;
    if (!pending.length) return { sent: 0, failed: 0, removed: 0 };

    // Claim the rows first so concurrent dispatches never double-send.
    const { data: claimed, error: claimError } = await admin
      .from("notifications")
      .update({ pushed_at: new Date().toISOString() })
      .in(
        "id",
        pending.map((n) => n.id),
      )
      .is("pushed_at", null)
      .select("id, profile_id, org_id, kind, title, body, href");
    if (claimError) throw claimError;
    if (!claimed.length) return { sent: 0, failed: 0, removed: 0 };

    const recipients = [...new Set(claimed.map((n) => n.profile_id))];
    const [{ data: subs }, { data: profiles }, { data: memberships }] = await Promise.all([
      admin
        .from("push_subscriptions")
        .select("id, profile_id, endpoint, p256dh, auth")
        .in("profile_id", recipients),
      admin.from("profiles").select("id, push_muted").in("id", recipients),
      admin.from("org_memberships").select("profile_id, org_id, role").in("profile_id", recipients),
    ]);
    if (!subs?.length) return { sent: 0, failed: 0, removed: 0 };

    const muted = new Map((profiles ?? []).map((p) => [p.id, new Set(p.push_muted)]));
    const roles = new Map((memberships ?? []).map((m) => [`${m.profile_id}:${m.org_id}`, m.role]));

    const jobs: { subId: string; send: () => Promise<unknown> }[] = [];
    for (const n of claimed) {
      if (muted.get(n.profile_id)?.has(n.kind)) continue;
      const role = roles.get(`${n.profile_id}:${n.org_id}`);
      if (!role) continue; // no longer on that team
      const payload = JSON.stringify({
        title: n.title,
        body: n.body ?? "",
        url: hrefForRole(n.href, role),
        tag: n.id,
      });
      for (const s of subs) {
        if (s.profile_id !== n.profile_id) continue;
        jobs.push({
          subId: s.id,
          send: () =>
            webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              payload,
              {
                TTL: 60 * 60 * 24,
                vapidDetails: {
                  subject: cfg.subject,
                  publicKey: cfg.publicKey,
                  privateKey: cfg.privateKey,
                },
              },
            ),
        });
      }
    }

    const results = await Promise.allSettled(jobs.map((j) => j.send()));
    const gone = new Set<string>();
    let sent = 0;
    let failed = 0;
    results.forEach((r, i) => {
      if (r.status === "fulfilled") return void sent++;
      failed++;
      const status = r.reason instanceof WebPushError ? r.reason.statusCode : undefined;
      if (status === 404 || status === 410) gone.add(jobs[i].subId);
      else console.error("Push failed:", status ?? "", r.reason?.message ?? r.reason);
    });
    if (gone.size)
      await admin
        .from("push_subscriptions")
        .delete()
        .in("id", [...gone]);
    return { sent, failed, removed: gone.size };
  } catch (e) {
    console.error("dispatchPush:", e instanceof Error ? e.message : e);
    return { sent: 0, failed: 0, removed: 0, skipped: "error" };
  }
}
