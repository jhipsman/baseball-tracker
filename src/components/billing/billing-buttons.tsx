"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { openBillingPortal, startSubscription } from "@/lib/billing-actions";
import { OPEN_WHEN_ENDED } from "@/lib/billing";
import { cn } from "@/lib/utils";

export function SubscribeButtons({ monthly, yearly }: { monthly: number; yearly: number }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const go = (interval: "month" | "year") =>
    start(async () => {
      setError("");
      const r = await startSubscription(interval);
      if (r.url) window.location.assign(r.url);
      else setError(r.error ?? "Checkout couldn't open.");
    });
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => go("month")}
          className="h-12 rounded-full bg-brand-700 px-5 font-semibold text-on-brand disabled:opacity-60"
        >
          ${monthly} a month
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => go("year")}
          className="h-12 rounded-full bg-surface px-5 font-semibold ring-1 ring-zinc-300 disabled:opacity-60"
        >
          ${yearly} a year{" "}
          <span className="text-sm font-normal text-zinc-500">(2 months free)</span>
        </button>
      </div>
      <p className="text-xs text-zinc-500">
        Secure checkout by Stripe. Have a code? Enter it at checkout.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function ManageBillingButton() {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError("");
            const r = await openBillingPortal();
            if (r.url) window.location.assign(r.url);
            else setError(r.error ?? "Billing page couldn't open.");
          })
        }
        className="h-11 rounded-full px-5 text-sm font-semibold ring-1 ring-zinc-300 disabled:opacity-60"
      >
        {pending ? "Opening…" : "Manage billing"}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** After a trial ends, coach pages are view-only (Settings stays open to subscribe). */
export function TrialLock({ locked, children }: { locked: boolean; children: React.ReactNode }) {
  const path = usePathname();
  const off = locked && !OPEN_WHEN_ENDED.some((p) => path === p || path.startsWith(`${p}/`));
  return (
    <fieldset disabled={off} className={cn("m-0 min-w-0 border-0 p-0", off && "opacity-95")}>
      {children}
    </fieldset>
  );
}
