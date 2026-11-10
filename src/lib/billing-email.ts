import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { sendOneEmail } from "@/lib/email";
import { billingEmail, type BillingEmailKind } from "@/lib/email-templates";

/**
 * Emails a team's admins about their 9D subscription. Called by the billing
 * webhook with the service-role client. A no-op without email set up, and it
 * never throws: a missed email must not make Stripe retry the webhook.
 */
export async function emailTeamAdmins(
  db: SupabaseClient<Database>,
  orgId: string,
  kind: BillingEmailKind,
  renewsAt?: string | null,
) {
  try {
    const [{ data: org }, { data: admins }] = await Promise.all([
      db.from("organizations").select("name, is_demo").eq("id", orgId).maybeSingle(),
      db
        .from("org_memberships")
        .select("profile:profiles (email)")
        .eq("org_id", orgId)
        .eq("role", "admin"),
    ]);
    if (!org || org.is_demo) return;
    const msg = billingEmail(kind, { team: org.name, renewsAt });
    const emails = new Set(
      (admins ?? [])
        .map((a) => a.profile?.email)
        .filter((e): e is string => !!e && !e.endsWith(".invalid")),
    );
    for (const to of emails) await sendOneEmail(to, msg);
  } catch (e) {
    console.error("Billing email failed:", (e as Error).message);
  }
}
