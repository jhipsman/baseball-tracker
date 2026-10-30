import { randomUUID } from "node:crypto";
import { requireActiveOrg } from "@/lib/org";
import { playerToday } from "@/lib/player";
import { paymentAdmin, teamPaymentsReady } from "@/lib/stripe-team";
import { installmentDates, invoiceBalance, money } from "@/lib/team-payments";
import { PaymentPlanForm } from "./plan-form";
import {
  AutopayControl,
  CancelPlanButton,
  ConnectPaymentsButton,
  InvoiceControls,
} from "./payment-controls";
export async function PaymentDashboard({ admin }: { admin: boolean }) {
  const { org, supabase, user } = await requireActiveOrg();
  const { today } = await playerToday();
  const [
    { data: plans, error },
    { data: invoices, error: invoicesError },
    { data: transactions, error: transactionsError },
    { data: members },
  ] = await Promise.all([
    supabase
      .from("team_payment_plans")
      .select("*")
      .eq("org_id", org.id)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("team_invoices").select("*").eq("org_id", org.id).order("due_date").limit(2000),
    supabase
      .from("team_payment_transactions")
      .select("*")
      .eq("org_id", org.id)
      .order("created_at", { ascending: false })
      .limit(2000),
    admin
      ? supabase
          .from("org_memberships")
          .select("profile_id,role,profile:profiles(full_name,email)")
          .eq("org_id", org.id)
      : Promise.resolve({ data: [] }),
  ]);
  const ready = teamPaymentsReady();
  const { data: account } = ready
    ? await paymentAdmin()
        .from("org_payment_accounts")
        .select("charges_enabled")
        .eq("org_id", org.id)
        .maybeSingle()
    : { data: null };
  const online = ready && !!account?.charges_enabled;
  const names = new Map(
    (members ?? []).map((m) => [m.profile_id, m.profile.full_name || m.profile.email]),
  );
  const due = (invoices ?? []).reduce((sum, i) => sum + invoiceBalance(i), 0);
  const overdue = (invoices ?? [])
    .filter((i) => i.due_date < today && invoiceBalance(i) > 0)
    .reduce((sum, i) => sum + invoiceBalance(i), 0);
  const paid = (transactions ?? [])
      .filter((t) => t.kind === "payment")
      .reduce((s, t) => s + t.amount_cents, 0),
    refunded = (transactions ?? [])
      .filter((t) => t.kind === "refund")
      .reduce((s, t) => s + t.amount_cents, 0);
  if (error || invoicesError || transactionsError)
    return (
      <p className="rounded-xl bg-surface p-6 text-sm text-amber-800 ring-1 ring-zinc-200">
        Team payments are temporarily unavailable. Please try again shortly.
      </p>
    );
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ["Outstanding", due],
          ["Overdue", overdue],
          ["Received before fees", paid],
          ["Refunded", refunded],
        ].map(([label, value]) => (
          <section key={label} className="rounded-xl bg-surface p-5 ring-1 ring-zinc-200">
            <h2 className="text-sm text-zinc-600">{label}</h2>
            <p className="mt-2 text-2xl font-medium tabular-nums">{money(Number(value))}</p>
          </section>
        ))}
      </div>
      <section className="space-y-3 rounded-xl bg-surface p-5 ring-1 ring-zinc-200">
        <h2 className="font-semibold">{online ? "Secure online payments" : "Payment setup"}</h2>
        <p className="text-sm text-zinc-600">
          {online
            ? "Pay securely through Stripe using the payment methods available for your team. The installment amount is the amount charged; this app adds no transaction markup. Stripe processing fees are deducted from your organization’s payout."
            : "Online checkout and autopay are not available until your team completes payment setup. Installment schedules and offline payment records still work."}
        </p>
        {admin && <ConnectPaymentsButton ready={ready} />}
        <p className="text-xs text-zinc-500">
          Monthly installments are team dues, separate from any subscription for using this app.
          Payment confirmations come from the processor; a return from checkout alone does not mark
          an invoice paid.
        </p>
      </section>
      {admin && (
        <details className="rounded-xl bg-surface p-5 ring-1 ring-zinc-200">
          <summary className="cursor-pointer font-semibold">Create installment plan</summary>
          <div className="mt-5">
            <PaymentPlanForm
              members={(members ?? []).map((m) => ({
                id: m.profile_id,
                name: names.get(m.profile_id) ?? "Member",
                role: m.role,
              }))}
              today={today}
              requestId={randomUUID()}
            />
          </div>
        </details>
      )}
      {!plans?.length && (
        <p className="rounded-xl bg-surface p-6 text-sm text-zinc-600 ring-1 ring-zinc-200">
          {admin
            ? "No payment plans yet. Create one to preview monthly due dates and assign a payer."
            : "No team payments are assigned to your account. Your coach will let you know when dues are ready."}
        </p>
      )}
      {(plans ?? []).map((plan) => {
        const rows = (invoices ?? []).filter((i) => i.plan_id === plan.id),
          active = ["active", "past_due"].includes(plan.autopay_status),
          dates = installmentDates(plan.first_due, plan.installments);
        return (
          <section
            key={plan.id}
            className="space-y-4 rounded-xl bg-surface p-5 ring-1 ring-zinc-200"
          >
            <div>
              <h2 className="text-lg font-semibold">{plan.title}</h2>
              <p className="mt-1 text-sm text-zinc-600">
                {plan.season} · {admin ? (names.get(plan.payer_id ?? "") ?? "Payer") : "Your plan"}{" "}
                · {plan.installments} × {money(plan.installment_cents)} · {plan.status}
                {active ? ` · autopay ${plan.autopay_status}` : ""}
              </p>
            </div>
            {(plan.payer_id === user.id || (admin && active)) && (
              <AutopayControl
                planId={plan.id}
                active={active}
                amount={plan.installment_cents}
                count={plan.installments}
                first={plan.first_due}
                last={dates.at(-1) ?? plan.first_due}
                online={online}
                eligible={
                  plan.payer_id === user.id &&
                  plan.status === "active" &&
                  rows.every((i) => i.paid_cents === 0 && i.status === "open")
                }
              />
            )}
            {admin && plan.status === "active" && <CancelPlanButton planId={plan.id} />}
            {rows.map((i) => (
              <article key={i.id} className="space-y-3 border-t border-zinc-200 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">
                      Installment {i.installment_number} · due {i.due_date}
                    </h3>
                    <p className="mt-1 text-xs text-zinc-600">
                      Invoice {i.id.slice(0, 8)} · {i.status}
                      {i.status === "open" && i.due_date < today ? " · Overdue" : ""}
                      {i.refunded_cents ? ` · ${money(i.refunded_cents)} refunded` : ""}
                    </p>
                  </div>
                  <strong className="text-lg font-medium tabular-nums">
                    {money(invoiceBalance(i))} due
                  </strong>
                </div>
                <InvoiceControls
                  invoiceId={i.id}
                  balance={invoiceBalance(i)}
                  refundable={i.paid_cents - i.refunded_cents}
                  admin={admin}
                  online={online}
                  autopay={active}
                />
                <details className="text-xs text-zinc-600">
                  <summary className="cursor-pointer">Payment history</summary>
                  <p className="mt-2">
                    Original installment: {money(i.amount_cents)} · paid: {money(i.paid_cents)}
                  </p>
                  {(transactions ?? [])
                    .filter((t) => t.invoice_id === i.id)
                    .map((t) => (
                      <p key={t.id} className="mt-2">
                        {new Date(t.created_at).toLocaleDateString("en-US", { timeZone: "UTC" })} ·{" "}
                        {t.kind} · {money(t.amount_cents)} · {t.method}
                        {t.reference ? ` · ${t.reference}` : ""}
                        {admin && t.processor_fee_cents !== null
                          ? ` · reported processing fee ${money(t.processor_fee_cents)}`
                          : ""}
                        {t.note ? ` · ${t.note}` : ""}
                      </p>
                    ))}
                </details>
              </article>
            ))}
          </section>
        );
      })}
      {(invoices?.length === 2000 || transactions?.length === 2000 || plans?.length === 500) && (
        <p className="text-sm text-amber-800">
          This view has reached its record limit. Totals reflect the displayed records; contact
          support for a complete export.
        </p>
      )}
    </div>
  );
}
