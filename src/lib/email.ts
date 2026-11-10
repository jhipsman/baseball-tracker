import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { BRAND } from "@/constants/brand";
import { ROLE_LABELS } from "@/constants";
import { hrefForRole } from "@/lib/notifications";
import { emailHtml } from "@/lib/email-layout";

/** Notifications older than this are never emailed (seen in the app, or stale). */
const WINDOW_MS = 15 * 60 * 1000;

type EmailConfig = {
  key: string;
  from: string;
  site: string;
  url: string;
  secret: string;
  /** Resend's API (overridable for tests). */
  api: string;
};

function emailConfig(): EmailConfig | null {
  const env = process.env;
  const key = env.RESEND_API_KEY?.trim();
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  const site = (
    env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : "")
  ).replace(/\/$/, "");
  if (!key || !url || !secret || !site) return null;
  const from = env.EMAIL_FROM?.trim() || `${BRAND.name} <no-reply@${new URL(site).hostname}>`;
  const api = (env.RESEND_API_URL?.trim() || "https://api.resend.com").replace(/\/$/, "");
  return { key, from, site, url, secret, api };
}

export const emailEnabled = () => emailConfig() !== null;

export { emailHtml } from "@/lib/email-layout";

export async function sendEmail(
  cfg: EmailConfig,
  msg: { to: string; subject: string; html: string; text: string },
): Promise<boolean> {
  try {
    const res = await fetch(`${cfg.api}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: cfg.from,
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }),
    });
    if (!res.ok) console.error("Email failed:", res.status, (await res.text()).slice(0, 300));
    return res.ok;
  } catch (e) {
    console.error("Email failed:", (e as Error).message);
    return false;
  }
}

export type MailResult = { sent: number; failed: number; skipped?: string };

/**
 * Emails recent notifications (one email per person, combining several) and
 * new invitations. Claims rows first so nothing is sent twice. Respects each
 * person's email mutes. A no-op without RESEND_API_KEY. Never throws.
 */
export async function dispatchEmail(): Promise<MailResult> {
  const cfg = emailConfig();
  if (!cfg) return { sent: 0, failed: 0, skipped: "not configured" };
  try {
    const admin = createClient<Database>(cfg.url, cfg.secret, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const [n, i] = await Promise.all([notificationEmails(admin, cfg), inviteEmails(admin, cfg)]);
    return { sent: n.sent + i.sent, failed: n.failed + i.failed };
  } catch (e) {
    console.error("Email dispatch failed:", (e as Error).message);
    return { sent: 0, failed: 0, skipped: "error" };
  }
}

type Admin = ReturnType<typeof createClient<Database>>;

async function notificationEmails(admin: Admin, cfg: EmailConfig) {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { data: pending } = await admin
    .from("notifications")
    .select("id")
    .is("emailed_at", null)
    .gte("created_at", since)
    .limit(500);
  if (!pending?.length) return { sent: 0, failed: 0 };
  const { data: claimed } = await admin
    .from("notifications")
    .update({ emailed_at: new Date().toISOString() })
    .in(
      "id",
      pending.map((p) => p.id),
    )
    .is("emailed_at", null)
    .select("id, profile_id, org_id, kind, title, body, href, read_at");
  if (!claimed?.length) return { sent: 0, failed: 0 };
  const people = [...new Set(claimed.map((c) => c.profile_id))];
  const orgs = [...new Set(claimed.map((c) => c.org_id))];
  const [{ data: profiles }, { data: memberships }, { data: teams }] = await Promise.all([
    admin.from("profiles").select("id, email, full_name, email_muted").in("id", people),
    admin.from("org_memberships").select("profile_id, org_id, role").in("profile_id", people),
    admin.from("organizations").select("id, name, is_demo").in("id", orgs),
  ]);
  const role = new Map((memberships ?? []).map((m) => [`${m.profile_id}:${m.org_id}`, m.role]));
  const team = new Map((teams ?? []).map((t) => [t.id, t]));
  let sent = 0,
    failed = 0;
  for (const p of profiles ?? []) {
    const muted = new Set(p.email_muted ?? []);
    const mine = claimed.filter(
      (c) =>
        c.profile_id === p.id &&
        !c.read_at &&
        !muted.has(c.kind) &&
        role.has(`${p.id}:${c.org_id}`) &&
        !team.get(c.org_id)?.is_demo,
    );
    if (!mine.length || !p.email || p.email.endsWith(".invalid")) continue;
    const link = (c: (typeof mine)[number]) =>
      `${cfg.site}${hrefForRole(c.href, role.get(`${p.id}:${c.org_id}`)!)}`;
    const teamName = team.get(mine[0].org_id)?.name ?? BRAND.name;
    const one = mine.length === 1 ? mine[0] : null;
    const subject = one ? one.title : `${mine.length} updates from ${teamName}`;
    const lines = one
      ? [one.body ?? "", teamName].filter(Boolean)
      : mine.slice(0, 8).map((c) => `• ${c.title}${c.body ? `: ${c.body}` : ""}`);
    const ok = await sendEmail(cfg, {
      to: p.email,
      subject,
      html: emailHtml({
        site: cfg.site,
        heading: one ? one.title : subject,
        lines,
        button: { label: "Open in 9D", href: one ? link(one) : `${cfg.site}/notifications` },
      }),
      text: `${subject}\n\n${lines.join("\n")}\n\n${one ? link(one) : `${cfg.site}/notifications`}`,
    });
    if (ok) sent++;
    else failed++;
  }
  return { sent, failed };
}

async function inviteEmails(admin: Admin, cfg: EmailConfig) {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: claimed } = await admin
    .from("org_invitations")
    .update({ emailed_at: new Date().toISOString() })
    .is("emailed_at", null)
    .is("accepted_at", null)
    .gte("created_at", since)
    .select(
      "id, org_id, email, role, token, invited_by, player_id, claim_profile_id, extra_player_ids",
    );
  if (!claimed?.length) return { sent: 0, failed: 0 };
  const ids = [
    ...new Set(
      claimed
        .flatMap((c) => [
          c.invited_by,
          c.player_id,
          c.claim_profile_id,
          ...(c.extra_player_ids ?? []),
        ])
        .filter(Boolean),
    ),
  ] as string[];
  const [{ data: teams }, { data: people }] = await Promise.all([
    admin
      .from("organizations")
      .select("id, name, is_demo")
      .in(
        "id",
        claimed.map((c) => c.org_id),
      ),
    ids.length
      ? admin.from("profiles").select("id, full_name, email").in("id", ids)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string }[] }),
  ]);
  const name = (id: string | null) => {
    const p = (people ?? []).find((x) => x.id === id);
    return p ? p.full_name || p.email : null;
  };
  let sent = 0,
    failed = 0;
  for (const c of claimed) {
    const t = (teams ?? []).find((x) => x.id === c.org_id);
    if (!t || t.is_demo) continue;
    const by = name(c.invited_by);
    const kids = (c.role === "parent" ? [c.player_id, ...(c.extra_player_ids ?? [])] : [])
      .map(name)
      .filter(Boolean) as string[];
    const child = kids.length ? kids.join(" and ") : null;
    const claim = !!c.claim_profile_id;
    const href = `${cfg.site}/${claim ? "claim" : "invite"}/${c.token}`;
    const role = ROLE_LABELS[c.role].toLowerCase();
    const heading = claim ? `Set up your ${BRAND.name} login` : `Join ${t.name} on ${BRAND.name}`;
    const lines = claim
      ? [
          `${by ?? "Your coach"} added you to ${t.name} on ${BRAND.name}. Choose a password to see your schedule, workouts and stats.`,
          `You'll sign in with this email address (${c.email}). The link works for 14 days.`,
        ]
      : [
          `${by ?? "Your coach"} invited you to join ${t.name} as a ${role}${child ? ` (for ${child})` : ""}.`,
          `${BRAND.name} has the team schedule, messages, training and live game updates. It's free for players and parents.`,
          `Use this email address (${c.email}) when you sign up. The link works for 14 days.`,
        ];
    const ok = await sendEmail(cfg, {
      to: c.email,
      subject: heading,
      html: emailHtml({
        site: cfg.site,
        heading,
        lines,
        button: { label: claim ? "Set up my account" : "Accept invitation", href },
        footer: `${BRAND.legalName} · You got this because ${by ?? "a coach"} invited ${c.email}. Not expecting it? Ignore this email.`,
      }),
      text: `${heading}\n\n${lines.join("\n")}\n\n${href}`,
    });
    if (ok) sent++;
    else failed++;
  }
  return { sent, failed };
}

/** A one-off email (e.g. a registration receipt). No-op without email set up. */
export async function sendOneEmail(
  to: string,
  o: {
    subject: string;
    heading: string;
    lines: string[];
    button?: { label: string; path: string };
  },
) {
  const cfg = emailConfig();
  if (!cfg || !to) return false;
  const button = o.button
    ? { label: o.button.label, href: `${cfg.site}${o.button.path}` }
    : undefined;
  return sendEmail(cfg, {
    to,
    subject: o.subject,
    html: emailHtml({ site: cfg.site, heading: o.heading, lines: o.lines, button }),
    text: `${o.heading}\n\n${o.lines.join("\n")}${button ? `\n\n${button.href}` : ""}`,
  });
}
