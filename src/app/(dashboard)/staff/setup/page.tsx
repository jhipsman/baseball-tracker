import Link from "next/link";
import { loadRates, loadStaff, requireStaffPay } from "@/lib/staff-data";
import { PAY_TYPES } from "@/lib/staff-pay";
import { money } from "@/lib/team-payments";
import { RateForm } from "@/components/staff/controls";
import { Disclosure } from "@/components/ui/disclosure";

export const metadata = { title: "Pay setup" };

const ROLE: Record<string, string> = { admin: "Admin", coach: "Coach", trainer: "Trainer" };

export default async function PaySetup() {
  const ctx = await requireStaffPay(true);
  const [staff, rates] = await Promise.all([loadStaff(ctx), loadRates(ctx)]);
  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">Pay setup</h1>
        <p className="mt-1 text-sm text-zinc-600">
          How each coach on this team is paid. Changes apply to time approved from now on. Coaches
          only see their own pay.
        </p>
      </header>
      <ul className="space-y-3">
        {staff.map((s) => {
          const rate = rates.get(s.id) ?? null;
          const type = PAY_TYPES.find((p) => p.key === rate?.pay_type);
          const summary = !rate
            ? "Not set up"
            : rate.pay_type === "hourly" || rate.pay_type === "per_session"
              ? `${type?.label} · ${money(rate.rate_cents)} ${type?.unit}`
              : rate.pay_type === "stipend"
                ? `${type?.label} · ${money(rate.stipend_cents)} in ${rate.stipend_payments} payment${rate.stipend_payments === 1 ? "" : "s"}`
                : "Volunteer";
          return (
            <li key={s.id} className="space-y-2 rounded-2xl bg-surface p-4 ring-1 ring-zinc-200">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-sm text-zinc-500">{rate?.title || ROLE[s.role] || "Coach"}</p>
                </div>
                <p className={rate ? "text-sm font-medium" : "text-sm font-medium text-amber-900"}>
                  {summary}
                </p>
              </div>
              <Disclosure label={rate ? "Change" : "Set up pay"} openLabel="Close">
                <RateForm profileId={s.id} rate={rate} />
              </Disclosure>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-zinc-600">
        Missing someone? Invite them as a coach in{" "}
        <Link href="/roster/manage" className="font-semibold text-brand-700">
          Members &amp; invites
        </Link>
        .
      </p>
    </div>
  );
}
