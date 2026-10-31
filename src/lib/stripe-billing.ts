import "server-only";
import type Stripe from "stripe";
import { PRICING } from "@/constants/pricing";
import { BRAND } from "@/constants/brand";

/** Your own subscription prices (9D Systems' Stripe account, not teams' accounts). */
export const PRICE_KEYS = {
  month: "9d_team_monthly",
  year: "9d_team_yearly",
} as const;
export type Interval = keyof typeof PRICE_KEYS;

/**
 * The Team plan's prices, found by lookup key and created the first time
 * (so there's nothing to set up in the Stripe dashboard). Amounts follow
 * src/constants/pricing.ts; a changed amount gets a new price under the key.
 */
export async function teamPrice(stripe: Stripe, interval: Interval): Promise<string> {
  const amount = (interval === "month" ? PRICING.team.monthly : PRICING.team.yearly) * 100;
  const { data } = await stripe.prices.list({
    lookup_keys: Object.values(PRICE_KEYS),
    active: true,
    expand: ["data.product"],
  });
  const existing = data.find((p) => p.lookup_key === PRICE_KEYS[interval]);
  if (existing && existing.unit_amount === amount) return existing.id;
  const productId =
    (existing?.product as Stripe.Product | undefined)?.id ??
    (data[0]?.product as Stripe.Product | undefined)?.id ??
    (
      await stripe.products.create({
        name: `${BRAND.name} Team`,
        description: "Everything in 9D for one team: coaches, players and parents.",
      })
    ).id;
  const price = await stripe.prices.create({
    product: productId,
    currency: "usd",
    unit_amount: amount,
    recurring: { interval },
    lookup_key: PRICE_KEYS[interval],
    transfer_lookup_key: true,
  });
  return price.id;
}

/** Status Stripe reports → what the team gets. */
export function planFromSubscription(sub: Stripe.Subscription) {
  const live = ["active", "trialing", "past_due"].includes(sub.status);
  const items = sub.items?.data ?? [];
  // Newer API versions keep the period on the item; older ones on the subscription.
  const end =
    items[0]?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    null;
  return {
    plan_tier: live ? ("pro" as const) : ("free" as const),
    plan_status: (["active", "trialing", "past_due", "canceled", "incomplete", "unpaid"].includes(
      sub.status,
    )
      ? sub.status
      : "canceled") as string,
    stripe_subscription_id: sub.id,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    plan_renews_at: end ? new Date(end * 1000).toISOString() : null,
  };
}
