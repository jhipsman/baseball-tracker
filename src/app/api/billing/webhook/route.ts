import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { paymentAdmin, teamStripe } from "@/lib/stripe-team";
import { planFromSubscription } from "@/lib/stripe-billing";
import { emailTeamAdmins } from "@/lib/billing-email";

export const runtime = "nodejs";

/** 9D subscriptions (your Stripe account's own events, not teams' accounts). */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature"),
    secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret)
    return NextResponse.json({ error: "Webhook unavailable." }, { status: 400 });
  const raw = await request.text();
  if (raw.length > 1_000_000) return new NextResponse(null, { status: 413 });
  let event: Stripe.Event;
  const stripe = teamStripe();
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }
  if (event.account) return NextResponse.json({ ignored: "connected account" });
  const db = paymentAdmin();
  const { data: seen } = await db
    .from("billing_events")
    .select("event_id")
    .eq("event_id", event.id)
    .maybeSingle();
  if (seen) return NextResponse.json({ received: true, duplicate: true });

  try {
    let sub: Stripe.Subscription | null = null;
    let orgId: string | null = null;
    if (event.type === "checkout.session.completed") {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.mode === "subscription" && s.subscription) {
        orgId = s.client_reference_id ?? s.metadata?.org_id ?? null;
        sub = await stripe.subscriptions.retrieve(
          typeof s.subscription === "string" ? s.subscription : s.subscription.id,
        );
      }
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      sub = event.data.object as Stripe.Subscription;
      orgId = sub.metadata?.org_id ?? null;
    }
    if (sub && orgId) {
      const { error } = await db
        .from("organizations")
        .update(planFromSubscription(sub))
        .eq("id", orgId);
      if (error) throw error;
    }
    await db.from("billing_events").insert({ event_id: event.id });
    // Tell the team's admins, once the change is saved. Never fails the webhook.
    if (sub && orgId && event.type === "checkout.session.completed")
      await emailTeamAdmins(db, orgId, "subscribed", planFromSubscription(sub).plan_renews_at);
    else if (sub && orgId && event.type === "customer.subscription.deleted")
      await emailTeamAdmins(db, orgId, "canceled");
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("billing webhook failed", e);
    return NextResponse.json({ error: "Update failed; Stripe will retry." }, { status: 500 });
  }
}
