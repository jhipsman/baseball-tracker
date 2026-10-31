import Link from "next/link";
import type { BillingKind } from "@/lib/billing";
import { cn } from "@/lib/utils";

/** Top-of-page note for coaches: trial days left, a failed card, or the trial ended. */
export function TrialBanner({
  kind,
  daysLeft,
  admin,
}: {
  kind: BillingKind;
  daysLeft: number;
  admin: boolean;
}) {
  if (kind === "demo" || kind === "subscribed") return null;
  if (kind === "trial" && daysLeft > 7)
    return (
      <p className="mb-4 text-sm text-zinc-500">
        Free trial · {daysLeft} days left
        {admin ? (
          <>
            {" · "}
            <Link href="/settings#billing" className="font-semibold text-brand-700">
              Subscribe
            </Link>
          </>
        ) : null}
      </p>
    );
  const ended = kind === "ended";
  return (
    <div
      role="status"
      className={cn(
        "mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-4 py-3 text-sm ring-1",
        ended ? "bg-red-50 text-red-900 ring-red-200" : "bg-amber-50 text-amber-950 ring-amber-200",
      )}
    >
      <p className="min-w-0 flex-1">
        <b>
          {ended
            ? "Your free trial has ended."
            : kind === "past_due"
              ? "Your last payment didn't go through."
              : `Free trial: ${daysLeft} day${daysLeft === 1 ? "" : "s"} left.`}
        </b>{" "}
        {ended
          ? "Everything is saved and players and parents still have access; coach pages are view-only until you subscribe."
          : kind === "past_due"
            ? "Update your card to keep things running."
            : "Subscribe to keep managing your team after that."}
        {!admin ? " Ask your team admin." : ""}
      </p>
      {admin ? (
        <Link
          href="/settings#billing"
          className="inline-flex h-10 items-center rounded-full bg-zinc-900 px-4 font-semibold text-zinc-50"
        >
          {kind === "past_due" ? "Update card" : "Subscribe"}
        </Link>
      ) : null}
    </div>
  );
}
