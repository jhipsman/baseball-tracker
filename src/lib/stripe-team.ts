import "server-only";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
/** Names (never values) of settings online payments still need, for the admin's setup card. */
export function teamPaymentsMissing() {
  const missing: string[] = [];
  if (!process.env.STRIPE_SECRET_KEY) missing.push("STRIPE_SECRET_KEY");
  if (!process.env.STRIPE_TEAM_WEBHOOK_SECRET) missing.push("STRIPE_TEAM_WEBHOOK_SECRET");
  if (!(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY))
    missing.push("SUPABASE_SECRET_KEY");
  if (!process.env.NEXT_PUBLIC_SITE_URL) missing.push("NEXT_PUBLIC_SITE_URL");
  return missing;
}
export function teamPaymentsReady() {
  return !!(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_TEAM_WEBHOOK_SECRET &&
    (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) &&
    process.env.NEXT_PUBLIC_SITE_URL
  );
}
export function teamStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Payments are not set up yet.");
  return new Stripe(process.env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2, timeout: 15000 });
}
export function paymentAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Payment processing is unavailable.");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export function paymentSite() {
  const url = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "");
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname))
    throw new Error("Payment return address must use HTTPS.");
  return url.origin;
}
export const stripeId = (value: string | { id: string } | null | undefined) =>
  typeof value === "string" ? value : (value?.id ?? null);

/**
 * Teams' Stripe accounts (Accounts v2): Stripe collects the team's details and
 * covers losses, the team pays its own processing fees, and it gets its own
 * full Stripe dashboard. Money from family payments goes straight to the team.
 */
export async function createTeamAccount(
  stripe: Stripe,
  team: { orgId: string; name: string; email: string | undefined },
  idempotencyKey: string,
) {
  return stripe.v2.core.accounts.create(
    {
      display_name: team.name.slice(0, 100),
      ...(team.email ? { contact_email: team.email } : {}),
      identity: { country: "us" },
      dashboard: "full",
      defaults: {
        currency: "usd",
        responsibilities: { fees_collector: "stripe", losses_collector: "stripe" },
      },
      configuration: { merchant: { capabilities: { card_payments: { requested: true } } } },
      include: ["configuration.merchant", "requirements"],
      metadata: { org_id: team.orgId },
    },
    { idempotencyKey },
  );
}

/** Can the team take card payments yet? Works for v2 accounts and any older v1 ones. */
export async function teamAccountReady(stripe: Stripe, accountId: string) {
  try {
    const a = await stripe.v2.core.accounts.retrieve(accountId, {
      include: ["configuration.merchant"],
    });
    return a.configuration?.merchant?.capabilities?.card_payments?.status === "active";
  } catch {
    const a = await stripe.accounts.retrieve(accountId);
    return !!a.charges_enabled;
  }
}

/** Stripe-hosted sign-up for the team (v2 Account Link, falling back to v1 for older accounts). */
export async function teamOnboardingLink(
  stripe: Stripe,
  accountId: string,
  urls: { refresh: string; back: string },
) {
  const v2 = (withConfigurations: boolean) =>
    stripe.v2.core.accountLinks.create({
      account: accountId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          ...(withConfigurations ? { configurations: ["merchant"] } : {}),
          refresh_url: urls.refresh,
          return_url: urls.back,
        } as Stripe.V2.Core.AccountLinkCreateParams.UseCase.AccountOnboarding,
      },
    });
  try {
    return (await v2(true)).url;
  } catch (e) {
    const msg = String((e as { message?: string }).message ?? "");
    if (/configurations/i.test(msg)) return (await v2(false)).url;
    if (/v1|not a v2|Accounts v2/i.test(msg)) {
      const link = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: urls.refresh,
        return_url: urls.back,
        type: "account_onboarding",
      });
      return link.url;
    }
    throw e;
  }
}
