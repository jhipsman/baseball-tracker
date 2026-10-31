"use server";

import { requireRealActiveOrg } from "@/lib/org";
import { paymentAdmin, paymentSite, teamStripe } from "@/lib/stripe-team";
import { teamPrice, type Interval } from "@/lib/stripe-billing";

type R = { error?: string; url?: string };

function stripeReady() {
  return !!(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_WEBHOOK_SECRET &&
    (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) &&
    process.env.NEXT_PUBLIC_SITE_URL
  );
}

async function admin() {
  const ctx = await requireRealActiveOrg();
  if (ctx.membership.role !== "admin")
    return { error: "Only team admins can manage billing." } as const;
  if (!stripeReady())
    return {
      error: "Subscriptions aren't switched on yet. Your team keeps working meanwhile.",
    } as const;
  return ctx;
}

/** Stripe Checkout for the Team plan. Subscribing during the trial starts billing when the trial ends. */
export async function startSubscription(interval: Interval): Promise<R> {
  const ctx = await admin();
  if ("error" in ctx) return { error: ctx.error };
  if (interval !== "month" && interval !== "year") return { error: "Choose monthly or yearly." };
  if (ctx.org.is_demo) return { error: "Demo teams are always free." };
  try {
    const stripe = teamStripe();
    const { data: org } = await paymentAdmin()
      .from("organizations")
      .select("stripe_customer_id, plan_status, trial_ends_at")
      .eq("id", ctx.org.id)
      .single();
    if (org && ["active", "trialing", "past_due"].includes(org.plan_status ?? ""))
      return { error: "Your team already has a subscription. Use Manage billing to change it." };
    const price = await teamPrice(stripe, interval);
    const trialEnd = org?.trial_ends_at ? Math.floor(Date.parse(org.trial_ends_at) / 1000) : 0;
    const now = Math.floor(Date.now() / 1000);
    const site = paymentSite();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      ...(org?.stripe_customer_id
        ? { customer: org.stripe_customer_id }
        : { customer_email: ctx.user.email }),
      client_reference_id: ctx.org.id,
      metadata: { org_id: ctx.org.id },
      subscription_data: {
        metadata: { org_id: ctx.org.id },
        // Keep the rest of the free trial: first charge when it ends.
        ...(trialEnd > now + 48 * 3600 ? { trial_end: trialEnd } : {}),
      },
      allow_promotion_codes: true,
      success_url: `${site}/settings?billing=done#billing`,
      cancel_url: `${site}/settings#billing`,
    });
    return { url: session.url ?? undefined };
  } catch (e) {
    console.error("startSubscription failed", e);
    const msg = (e as { type?: string; message?: string }).message ?? "";
    return {
      error: `Checkout couldn't open${msg ? `: ${msg.slice(0, 200)}` : ""}. Try again shortly.`,
    };
  }
}

/** Stripe's billing page: card, receipts, switch monthly/yearly, cancel. */
export async function openBillingPortal(): Promise<R> {
  const ctx = await admin();
  if ("error" in ctx) return { error: ctx.error };
  const { data: org } = await paymentAdmin()
    .from("organizations")
    .select("stripe_customer_id")
    .eq("id", ctx.org.id)
    .single();
  if (!org?.stripe_customer_id)
    return { error: "Subscribe first; then you can manage billing here." };
  try {
    const session = await teamStripe().billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${paymentSite()}/settings#billing`,
    });
    return { url: session.url };
  } catch (e) {
    console.error("openBillingPortal failed", e);
    const msg = (e as { message?: string }).message ?? "";
    return {
      error: /portal|configuration/i.test(msg)
        ? "Stripe's billing page isn't turned on yet: in Stripe, open Settings → Billing → Customer portal and click Save."
        : "Billing page couldn't open. Try again shortly.",
    };
  }
}
