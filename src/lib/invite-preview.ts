import "server-only";

import { adminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type InvitePreview = {
  team: string;
  email: string;
  role: string;
  inviter: string | null;
  /** First names of the players a parent invite covers. */
  kids: string[];
};

/**
 * Who invited you, to which team, for which child: shown on sign-in and sign-up
 * when someone opens their invite link while signed out. Only the holder of the
 * secret link sees it. Null when the link is wrong, used, expired, or the
 * server key isn't set (the pages then fall back to general wording).
 */
export async function invitePreview(next: string | undefined): Promise<InvitePreview | null> {
  const token = next?.match(/^\/invite\/([^/?#]+)/)?.[1];
  if (!token || !UUID.test(token)) return null;
  const db = adminClient();
  if (!db) return null;
  const { data: inv } = await db
    .from("org_invitations")
    .select(
      "email, role, player_id, extra_player_ids, invited_by, accepted_at, expires_at, org:organizations (name)",
    )
    .eq("token", token)
    .maybeSingle();
  if (!inv || inv.accepted_at || new Date(inv.expires_at) < new Date()) return null;
  const ids = [inv.player_id, inv.invited_by, ...(inv.extra_player_ids ?? [])].filter(
    (x): x is string => !!x,
  );
  const { data: people } = ids.length
    ? await db.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] };
  const name = new Map((people ?? []).map((p) => [p.id, p.full_name ?? ""]));
  const first = (id: string) => name.get(id)?.split(" ")[0] || null;
  return {
    team: inv.org?.name ?? "your team",
    email: inv.email,
    role: inv.role,
    inviter: inv.invited_by ? name.get(inv.invited_by) || null : null,
    kids: [inv.player_id, ...(inv.extra_player_ids ?? [])]
      .filter((x): x is string => !!x)
      .map(first)
      .filter((x): x is string => !!x),
  };
}

/** "Coach Dee invited you to follow Aiden and Ben on Riverside Rays." */
export function inviteLine(p: InvitePreview) {
  const who = p.inviter ? `${p.inviter} invited you` : "You're invited";
  const kids =
    p.kids.length > 1 ? `${p.kids.slice(0, -1).join(", ")} and ${p.kids.at(-1)}` : p.kids[0];
  if (p.role === "parent" && kids) return `${who} to follow ${kids} on ${p.team}.`;
  return `${who} to join ${p.team}.`;
}
