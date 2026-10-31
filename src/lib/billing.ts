/** Where a team stands with its 9D subscription (shared by server and UI). */

export type BillingKind = "demo" | "subscribed" | "past_due" | "trial" | "ended";

export function billingState(
  org: { is_demo?: boolean | null; plan_status: string | null; trial_ends_at: string | null },
  now: Date = new Date(),
): { kind: BillingKind; daysLeft: number; trialEnds: string | null } {
  const trialEnds = org.trial_ends_at;
  const daysLeft = trialEnds
    ? Math.max(0, Math.ceil((Date.parse(trialEnds) - now.getTime()) / 86_400_000))
    : 0;
  if (org.is_demo) return { kind: "demo", daysLeft, trialEnds };
  if (org.plan_status === "active" || org.plan_status === "trialing")
    return { kind: "subscribed", daysLeft, trialEnds };
  // Card failed: keep everything working while Stripe retries.
  if (org.plan_status === "past_due") return { kind: "past_due", daysLeft, trialEnds };
  if (trialEnds && Date.parse(trialEnds) > now.getTime())
    return { kind: "trial", daysLeft, trialEnds };
  return { kind: "ended", daysLeft: 0, trialEnds };
}

/** Coach pages that stay usable after a trial ends (to subscribe, or sort out an account). */
export const OPEN_WHEN_ENDED = ["/settings"];
