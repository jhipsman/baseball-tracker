import { PRICING } from "@/constants/pricing";
import { billingState } from "@/lib/billing";
import { formatGameDate } from "@/lib/games";
import { ManageBillingButton, SubscribeButtons } from "./billing-buttons";

/** Settings → Billing: where the team stands and what to do next. */
export function BillingCard({
  org,
  renewsAt,
}: {
  org: { is_demo: boolean; plan_status: string | null; trial_ends_at: string | null };
  renewsAt: string | null;
}) {
  const b = billingState(org);
  const { monthly, yearly } = PRICING.team;
  return (
    <section
      id="billing"
      className="scroll-mt-6 space-y-3 rounded-xl bg-surface p-5 ring-1 ring-zinc-200"
    >
      <h2 className="font-semibold">Billing</h2>
      {b.kind === "demo" ? (
        <p className="text-sm text-zinc-600">Demo teams are free. Nothing to pay.</p>
      ) : b.kind === "subscribed" || b.kind === "past_due" ? (
        <>
          <p className="text-sm text-zinc-700">
            {b.kind === "past_due" ? (
              <b className="text-amber-900">Your last payment didn&apos;t go through. </b>
            ) : (
              <b>✓ Team plan. </b>
            )}
            {org.plan_status === "trialing" && b.trialEnds
              ? `Your card is on file; first charge ${formatGameDate(b.trialEnds.slice(0, 10))}.`
              : renewsAt
                ? `Renews ${formatGameDate(renewsAt.slice(0, 10))}.`
                : ""}
          </p>
          <ManageBillingButton />
          <p className="text-xs text-zinc-500">
            Change card, switch monthly/yearly, get receipts or cancel.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm text-zinc-700">
            {b.kind === "trial"
              ? `Free trial: ${b.daysLeft} day${b.daysLeft === 1 ? "" : "s"} left${b.trialEnds ? ` (until ${formatGameDate(b.trialEnds.slice(0, 10))})` : ""}. Subscribe any time; you won't be charged until the trial ends.`
              : "Your free trial has ended. Subscribe to keep managing your team. Everything you set up is saved."}
          </p>
          <SubscribeButtons monthly={monthly} yearly={yearly} />
          <p className="text-xs text-zinc-500">Per team. Players and parents are always free.</p>
        </>
      )}
    </section>
  );
}
