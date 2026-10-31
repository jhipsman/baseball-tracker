import { describe, expect, it } from "vitest";
import { billingState } from "./billing";

const now = new Date("2026-11-01T12:00:00Z");
const org = (
  o: Partial<{ is_demo: boolean; plan_status: string | null; trial_ends_at: string | null }>,
) => ({
  is_demo: false,
  plan_status: null,
  trial_ends_at: "2026-11-15T12:00:00Z",
  ...o,
});

describe("billingState", () => {
  it("counts down a free trial", () => {
    expect(billingState(org({}), now)).toMatchObject({ kind: "trial", daysLeft: 14 });
    expect(billingState(org({ trial_ends_at: "2026-11-01T18:00:00Z" }), now).daysLeft).toBe(1);
  });
  it("ends the trial, but never for demo teams or subscribers", () => {
    const over = { trial_ends_at: "2026-10-30T00:00:00Z" };
    expect(billingState(org(over), now).kind).toBe("ended");
    expect(billingState(org({ ...over, is_demo: true }), now).kind).toBe("demo");
    expect(billingState(org({ ...over, plan_status: "active" }), now).kind).toBe("subscribed");
    expect(billingState(org({ ...over, plan_status: "trialing" }), now).kind).toBe("subscribed");
    expect(billingState(org({ ...over, plan_status: "past_due" }), now).kind).toBe("past_due");
    expect(billingState(org({ ...over, plan_status: "canceled" }), now).kind).toBe("ended");
  });
});

import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import type Stripe from "stripe";
import { planFromSubscription } from "./stripe-billing";

describe("planFromSubscription", () => {
  const sub = (status: string, itemEnd?: number) =>
    ({
      id: "sub_1",
      status,
      customer: "cus_1",
      items: { data: itemEnd ? [{ current_period_end: itemEnd }] : [] },
    }) as unknown as Stripe.Subscription;
  it("turns Stripe's status into the team's plan", () => {
    expect(planFromSubscription(sub("active", 1_800_000_000))).toMatchObject({
      plan_tier: "pro",
      plan_status: "active",
      stripe_customer_id: "cus_1",
      plan_renews_at: new Date(1_800_000_000 * 1000).toISOString(),
    });
    expect(planFromSubscription(sub("canceled")).plan_tier).toBe("free");
    expect(planFromSubscription(sub("past_due")).plan_tier).toBe("pro");
  });
});
