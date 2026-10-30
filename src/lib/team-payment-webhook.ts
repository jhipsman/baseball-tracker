import "server-only";
import type Stripe from "stripe";
import { createHash } from "node:crypto";
import { paymentAdmin, stripeId, teamStripe } from "@/lib/stripe-team";
import { installmentDates } from "@/lib/team-payments";
/** Signature verification belongs to the route; only verified connected-account events enter here. */
export async function handleTeamPaymentEvent(event: Stripe.Event) {
  const admin = paymentAdmin(),
    stripe = teamStripe();
  const accountId = event.account;
  if (!accountId) return;
  const { data: account, error: accountError } = await admin
    .from("org_payment_accounts")
    .select("*")
    .eq("stripe_account_id", accountId)
    .maybeSingle();
  if (accountError) throw accountError;
  if (!account) return;
  const orgId = account.org_id,
    options = { stripeAccount: accountId };
  async function paid(input: {
    invoiceId?: string;
    planId?: string;
    cents: number;
    paymentIntent: string;
    fee?: number;
  }) {
    const { error } = await admin.rpc("apply_team_stripe_payment", {
      p_event: event.id,
      p_org: orgId,
      p_invoice: input.invoiceId ?? null,
      p_plan: input.planId ?? null,
      p_cents: input.cents,
      p_provider: input.paymentIntent,
      p_kind: "payment",
      p_fee: input.fee ?? null,
    });
    if (error) throw new Error("Payment could not be recorded.");
  }
  async function fee(paymentIntent: string) {
    try {
      const pi = await stripe.paymentIntents.retrieve(
        paymentIntent,
        { expand: ["latest_charge.balance_transaction"] },
        options,
      );
      const charge = pi.latest_charge;
      if (
        charge &&
        typeof charge !== "string" &&
        charge.balance_transaction &&
        typeof charge.balance_transaction !== "string"
      )
        return charge.balance_transaction.fee;
    } catch {
      /* Fee reporting can lag asynchronous bank settlement. */
    }
    return undefined;
  }
  if (event.type === "account.updated") {
    const a = event.data.object;
    const { error } = await admin
      .from("org_payment_accounts")
      .update({
        charges_enabled: a.charges_enabled ?? false,
        payouts_enabled: a.payouts_enabled ?? false,
      })
      .eq("org_id", orgId);
    if (error) throw error;
    return;
  }
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object;
    if (session.metadata?.org_id !== orgId) return;
    if (session.mode === "subscription" && session.metadata.team_plan_id) {
      const subscriptionId = stripeId(session.subscription);
      if (!subscriptionId) throw new Error("Subscription is not ready.");
      const { data: plan, error } = await admin
        .from("team_payment_plans")
        .select("*")
        .eq("id", session.metadata.team_plan_id)
        .eq("org_id", orgId)
        .single();
      if (error || !plan) throw new Error("Plan not found.");
      if (plan.autopay_status === "canceled" && plan.stripe_subscription_id === subscriptionId)
        return;
      const dates = installmentDates(plan.first_due, plan.installments);
      const stopAt = Math.floor(Date.parse(dates.at(-1) + "T12:00:00Z") / 1000) + 14 * 86400;
      await stripe.subscriptions.update(
        subscriptionId,
        { cancel_at: stopAt, proration_behavior: "none" },
        options,
      );
      const { error: saveError } = await admin
        .from("team_payment_plans")
        .update({ stripe_subscription_id: subscriptionId, autopay_status: "active" })
        .eq("id", plan.id)
        .eq("org_id", orgId);
      if (saveError) throw saveError;
    } else if (
      session.mode === "payment" &&
      session.payment_status === "paid" &&
      session.metadata.team_invoice_id
    ) {
      const pi = stripeId(session.payment_intent);
      if (!pi || !session.amount_total) throw new Error("Payment is not settled.");
      await paid({
        invoiceId: session.metadata.team_invoice_id,
        cents: session.amount_total,
        paymentIntent: pi,
        fee: await fee(pi),
      });
    }
    return;
  }
  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const invoice = event.data.object;
    const subId = stripeId(invoice.parent?.subscription_details?.subscription);
    if (!subId) return;
    const subscription = await stripe.subscriptions.retrieve(subId, {}, options);
    const planId = subscription.metadata.team_plan_id;
    if (!planId || subscription.metadata.org_id !== orgId) return;
    const { data: plan } = await admin
      .from("team_payment_plans")
      .select("*")
      .eq("id", planId)
      .eq("org_id", orgId)
      .single();
    if (!plan) throw new Error("Payment plan not found.");
    if (event.type === "invoice.payment_failed") {
      const { error: statusError } = await admin
        .from("team_payment_plans")
        .update({ autopay_status: "past_due" })
        .eq("id", planId)
        .eq("org_id", orgId);
      if (statusError) throw statusError;
      if (!plan.payer_id) return;
      const hex = createHash("sha256").update(event.id).digest("hex").slice(0, 32),
        id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      const { error } = await admin.from("notifications").upsert(
        {
          id,
          org_id: orgId,
          profile_id: plan.payer_id,
          actor_id: null,
          kind: "announcement",
          title: "Payment needs attention",
          body: "Your installment did not go through. Open Payments to review your plan.",
          href: "/payments",
        },
        { onConflict: "id", ignoreDuplicates: true },
      );
      if (error) throw error;
      return;
    }
    if (invoice.amount_paid === 0) return; // Trial/setup invoices do not settle an installment.
    if (invoice.currency !== "usd" || invoice.amount_paid !== plan.installment_cents)
      throw new Error("Unexpected installment amount.");
    const payments = await stripe.invoicePayments.list({ invoice: invoice.id }, options);
    const matched = payments.data.find(
      (p) => p.status === "paid" && p.payment.type === "payment_intent",
    );
    const pi = stripeId(matched?.payment.payment_intent);
    if (!pi) throw new Error("Settlement details are not ready.");
    await paid({ planId, cents: invoice.amount_paid, paymentIntent: pi, fee: await fee(pi) });
    const { error: statusError } = await admin
      .from("team_payment_plans")
      .update({ stripe_subscription_id: subId, autopay_status: "active" })
      .eq("id", planId)
      .eq("org_id", orgId);
    if (statusError) throw statusError;
    return;
  }
  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object;
    if (sub.metadata.org_id !== orgId) return;
    const { error } = await admin
      .from("team_payment_plans")
      .update({ autopay_status: "canceled" })
      .eq("stripe_subscription_id", sub.id)
      .eq("org_id", orgId);
    if (error) throw error;
    return;
  }
  if (event.type === "charge.refunded") {
    const charge = event.data.object,
      pi = stripeId(charge.payment_intent);
    if (!pi) return;
    const { data: original } = await admin
      .from("team_payment_transactions")
      .select("id")
      .eq("org_id", orgId)
      .eq("provider_payment_id", pi)
      .eq("kind", "payment")
      .maybeSingle();
    if (!original) throw new Error("Refund arrived before payment; retry after settlement.");
    const { error } = await admin.rpc("apply_team_stripe_payment", {
      p_event: event.id,
      p_org: orgId,
      p_invoice: null,
      p_plan: null,
      p_cents: charge.amount_refunded,
      p_provider: pi,
      p_kind: "refund",
      p_fee: null,
    });
    if (error) throw error;
  }
}
