"use server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { playerToday } from "@/lib/player";
import { requireActiveOrg } from "@/lib/org";
import { readCents, readPaymentPlan, invoiceBalance } from "@/lib/team-payments";
import { paymentAdmin, paymentSite, teamPaymentsReady, teamStripe } from "@/lib/stripe-team";
import { dispatchPush } from "@/lib/push";
import type { FormState } from "@/lib/auth/actions";
function refresh() {
  revalidatePath("/payments");
  revalidatePath("/dues");
}
export async function createPaymentPlan(
  _prev: FormState,
  fd: FormData,
): Promise<FormState & { createdId?: string }> {
  const { org, membership, supabase } = await requireActiveOrg();
  if (membership.role !== "admin") return { error: "Only admins can create installment plans." };
  const read = readPaymentPlan(fd);
  if ("error" in read) return read;
  const { data, error } = await supabase.rpc("create_team_payment_plan", {
    p_org: org.id,
    p_payer: read.payerId,
    p_player: read.playerId,
    p_title: read.title,
    p_season: read.season,
    p_cents: read.cents,
    p_count: read.count,
    p_first: read.date,
    p_request: read.requestId,
  });
  if (error)
    return { error: "The plan could not be created. Check the payer and player, then try again." };
  refresh();
  after(() => dispatchPush());
  return { message: "Payment plan created. Installments are ready to review.", createdId: data };
}
export async function recordOfflinePayment(input: {
  invoiceId: string;
  kind: "payment" | "refund";
  amount: string;
  method: "cash" | "check" | "bank";
  reference: string;
  note: string;
  requestId: string;
}): Promise<{ error?: string }> {
  const { org, membership, supabase } = await requireActiveOrg();
  if (membership.role !== "admin") return { error: "Only admins can record payments." };
  const cents = readCents(input?.amount);
  if (
    !cents ||
    !["cash", "check", "bank"].includes(input.method) ||
    !["payment", "refund"].includes(input.kind) ||
    !input.requestId ||
    input.requestId.length > 100 ||
    typeof input.reference !== "string" ||
    input.reference.length > 200 ||
    typeof input.note !== "string" ||
    input.note.length > 1000
  )
    return { error: "Check the amount, payment method and reference." };
  if (input.kind === "payment") {
    const { data: invoice } = await supabase
      .from("team_invoices")
      .select("stripe_checkout_id")
      .eq("id", input.invoiceId)
      .eq("org_id", org.id)
      .maybeSingle();
    if (invoice?.stripe_checkout_id) {
      try {
        const { data: account } = await paymentAdmin()
          .from("org_payment_accounts")
          .select("stripe_account_id")
          .eq("org_id", org.id)
          .single();
        if (!account) throw new Error();
        const stripe = teamStripe(),
          options = { stripeAccount: account.stripe_account_id };
        const session = await stripe.checkout.sessions.retrieve(
          invoice.stripe_checkout_id,
          {},
          options,
        );
        if (session.status === "complete")
          return {
            error:
              "An online payment is processing or already completed. Wait for confirmation before recording another payment.",
          };
        if (session.status === "open")
          await stripe.checkout.sessions.expire(session.id, {}, options);
      } catch {
        return {
          error:
            "The existing online checkout could not be closed. Try again before recording an offline payment.",
        };
      }
    }
  }
  const { error } = await supabase.rpc("record_team_payment", {
    p_org: org.id,
    p_invoice: input.invoiceId,
    p_kind: input.kind,
    p_cents: cents,
    p_method: input.method,
    p_reference: input.reference,
    p_note: input.note,
    p_request: input.requestId,
  });
  if (error)
    return {
      error: error.message.includes("Stop autopay")
        ? "Stop autopay before recording offline payments, so the payer is not charged twice."
        : "Payment was not recorded. Check the remaining balance or refundable amount, then try again.",
    };
  refresh();
  return {};
}
export async function remindInvoice(invoiceId: string): Promise<{ error?: string }> {
  const { org, membership, supabase } = await requireActiveOrg();
  if (membership.role !== "admin") return { error: "Only admins can send payment reminders." };
  const { error } = await supabase.rpc("remind_team_invoice", {
    p_org: org.id,
    p_invoice: invoiceId,
  });
  if (error)
    return {
      error:
        "A reminder could not be sent. The invoice may be settled, or this payer was already reminded today.",
    };
  after(() => dispatchPush());
  return {};
}
export async function connectTeamPayments(): Promise<{ error?: string; url?: string }> {
  const { org, membership } = await requireActiveOrg();
  if (membership.role !== "admin") return { error: "Only team admins can set up payments." };
  if (!teamPaymentsReady())
    return {
      error:
        "Online payments are not available yet. You can still manage installments and record offline payments.",
    };
  try {
    const stripe = teamStripe(),
      admin = paymentAdmin();
    let { data: account } = await admin
      .from("org_payment_accounts")
      .select("*")
      .eq("org_id", org.id)
      .maybeSingle();
    if (!account) {
      const created = await stripe.accounts.create(
        { type: "express", country: "US", metadata: { org_id: org.id } },
        { idempotencyKey: `team-account-${org.id}` },
      );
      const { error } = await admin
        .from("org_payment_accounts")
        .upsert({ org_id: org.id, stripe_account_id: created.id });
      if (error) throw error;
      account = {
        org_id: org.id,
        stripe_account_id: created.id,
        charges_enabled: false,
        payouts_enabled: false,
        created_at: new Date().toISOString(),
      };
    }
    const current = await stripe.accounts.retrieve(account.stripe_account_id);
    await admin
      .from("org_payment_accounts")
      .update({
        charges_enabled: current.charges_enabled ?? false,
        payouts_enabled: current.payouts_enabled ?? false,
      })
      .eq("org_id", org.id);
    if (current.charges_enabled) {
      refresh();
      return { url: `${paymentSite()}/payments` };
    }
    const link = await stripe.accountLinks.create({
      account: account.stripe_account_id,
      refresh_url: `${paymentSite()}/payments?setup=retry`,
      return_url: `${paymentSite()}/payments?setup=returned`,
      type: "account_onboarding",
    });
    return { url: link.url };
  } catch {
    return { error: "Payment setup could not be opened. Try again shortly." };
  }
}
export async function startTeamCheckout(input: {
  invoiceId?: string;
  planId?: string;
  autopay: boolean;
}): Promise<{ error?: string; url?: string }> {
  const { org, user, supabase } = await requireActiveOrg();
  if (!teamPaymentsReady()) return { error: "Online payments are not set up yet." };
  try {
    const stripe = teamStripe(),
      admin = paymentAdmin();
    const { data: account } = await admin
      .from("org_payment_accounts")
      .select("*")
      .eq("org_id", org.id)
      .maybeSingle();
    if (!account) return { error: "Your team has not completed payment setup yet." };
    const current = await stripe.accounts.retrieve(account.stripe_account_id);
    if (!current.charges_enabled)
      return { error: "Your team’s payment setup is still being verified." };
    const options = { stripeAccount: account.stripe_account_id };
    if (input.autopay) {
      const { data: plan } = await supabase
        .from("team_payment_plans")
        .select("*")
        .eq("id", input.planId ?? "")
        .eq("org_id", org.id)
        .eq("payer_id", user.id)
        .single();
      if (!plan || plan.status !== "active" || ["active", "past_due"].includes(plan.autopay_status))
        return { error: "This plan is not available for autopay enrollment." };
      const { data: invoices } = await supabase
        .from("team_invoices")
        .select("paid_cents,status")
        .eq("plan_id", plan.id);
      if (!invoices?.length || invoices.some((i) => i.paid_cents > 0 || i.status !== "open"))
        return {
          error:
            "Autopay can only start before any installments have been paid. Continue paying individual invoices for this plan.",
        };
      if (plan.stripe_checkout_id) {
        const old = await stripe.checkout.sessions.retrieve(plan.stripe_checkout_id, {}, options);
        if (old.status === "open" && old.url) return { url: old.url };
        if (old.status === "complete")
          return { error: "Autopay enrollment is processing. Refresh in a moment." };
      }
      const { today } = await playerToday();
      if (plan.first_due < today)
        return {
          error:
            "This plan has overdue installments. Pay individual invoices rather than starting a new autopay schedule.",
        };
      if (plan.first_due === today && plan.first_due !== new Date().toISOString().slice(0, 10))
        return {
          error:
            "Autopay cannot start on this plan’s current due date. Pay invoices individually, or ask your team for a future start date.",
        };
      const now = Math.floor(Date.now() / 1000),
        first =
          plan.first_due === today
            ? now
            : Math.floor(Date.parse(plan.first_due + "T12:00:00Z") / 1000);
      if (first > now && first < now + 48 * 3600)
        return {
          error: `Autopay can start on ${plan.first_due}. You can pay an individual installment now instead.`,
        };
      const session = await stripe.checkout.sessions.create(
        {
          mode: "subscription",
          customer_email: user.email,
          client_reference_id: plan.id,
          line_items: [
            {
              price_data: {
                currency: "usd",
                unit_amount: plan.installment_cents,
                recurring: { interval: "month" },
                product_data: { name: plan.title },
              },
              quantity: 1,
            },
          ],
          subscription_data: {
            metadata: { org_id: org.id, team_plan_id: plan.id },
            ...(first > now ? { trial_end: first } : {}),
          },
          metadata: { org_id: org.id, team_plan_id: plan.id },
          success_url: `${paymentSite()}/payments?checkout=processing`,
          cancel_url: `${paymentSite()}/payments`,
          custom_text: {
            submit: {
              message: `${plan.installments} monthly installments. No additional app transaction markup. Your team’s payment provider deducts processing fees from its payout.`,
            },
          },
        },
        {
          ...options,
          idempotencyKey: `plan-checkout-${plan.id}-${plan.stripe_checkout_id ?? "first"}`,
        },
      );
      const { error } = await admin
        .from("team_payment_plans")
        .update({ stripe_checkout_id: session.id })
        .eq("id", plan.id)
        .eq("org_id", org.id);
      if (error) throw error;
      return { url: session.url ?? undefined };
    }
    const { data: invoice } = await supabase
      .from("team_invoices")
      .select("*")
      .eq("id", input.invoiceId ?? "")
      .eq("org_id", org.id)
      .eq("payer_id", user.id)
      .single();
    if (!invoice || invoiceBalance(invoice) === 0)
      return { error: "This invoice has no remaining balance." };
    const { data: plan } = await supabase
      .from("team_payment_plans")
      .select("*")
      .eq("id", invoice.plan_id)
      .single();
    if (!plan || ["active", "past_due"].includes(plan.autopay_status))
      return { error: "Autopay manages this plan. Stop autopay before making a separate payment." };
    if (invoice.stripe_checkout_id) {
      const old = await stripe.checkout.sessions.retrieve(invoice.stripe_checkout_id, {}, options);
      if (old.status === "open" && old.url) return { url: old.url };
      if (old.status === "complete")
        return {
          error: "Your payment is processing. Refresh in a moment; please do not pay again.",
        };
    }
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: user.email,
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: invoiceBalance(invoice),
              product_data: { name: `${plan.title} · installment ${invoice.installment_number}` },
            },
            quantity: 1,
          },
        ],
        metadata: { org_id: org.id, team_invoice_id: invoice.id },
        payment_intent_data: { metadata: { org_id: org.id, team_invoice_id: invoice.id } },
        success_url: `${paymentSite()}/payments?checkout=processing`,
        cancel_url: `${paymentSite()}/payments`,
      },
      {
        ...options,
        idempotencyKey: `invoice-checkout-${invoice.id}-${invoice.paid_cents}-${invoice.stripe_checkout_id ?? "first"}`,
      },
    );
    const { error } = await admin
      .from("team_invoices")
      .update({ stripe_checkout_id: session.id })
      .eq("id", invoice.id)
      .eq("org_id", org.id);
    if (error) throw error;
    return { url: session.url ?? undefined };
  } catch {
    return {
      error:
        "Checkout could not be opened. No payment has been recorded; please try again shortly.",
    };
  }
}
export async function stopTeamAutopay(planId: string): Promise<{ error?: string }> {
  const { org, user, membership, supabase } = await requireActiveOrg();
  const { data: plan } = await supabase
    .from("team_payment_plans")
    .select("*")
    .eq("org_id", org.id)
    .eq("id", planId)
    .single();
  if (!plan || (plan.payer_id !== user.id && membership.role !== "admin"))
    return { error: "This payment plan is not available." };
  if (!plan.stripe_subscription_id) return {};
  try {
    const admin = paymentAdmin();
    const { data: account } = await admin
      .from("org_payment_accounts")
      .select("stripe_account_id")
      .eq("org_id", org.id)
      .single();
    if (!account) throw new Error();
    await teamStripe().subscriptions.cancel(
      plan.stripe_subscription_id,
      {},
      { stripeAccount: account.stripe_account_id },
    );
    const { error: saveError } = await admin
      .from("team_payment_plans")
      .update({ autopay_status: "canceled" })
      .eq("id", plan.id);
    if (saveError) throw saveError;
    refresh();
    return {};
  } catch {
    return {
      error: "Autopay could not be stopped. Try again; do not assume it has been canceled.",
    };
  }
}

export async function cancelTeamPaymentPlan(planId: string): Promise<{ error?: string }> {
  const { org, membership, supabase } = await requireActiveOrg();
  if (membership.role !== "admin") return { error: "Only admins can cancel unpaid balances." };
  const { data: plan } = await supabase
    .from("team_payment_plans")
    .select("*")
    .eq("id", planId)
    .eq("org_id", org.id)
    .single();
  if (!plan) return { error: "Payment plan not found." };
  if (["active", "past_due"].includes(plan.autopay_status))
    return { error: "Stop autopay first, then cancel unpaid balances." };
  const { data: invoices } = await supabase
    .from("team_invoices")
    .select("stripe_checkout_id")
    .eq("plan_id", planId)
    .eq("status", "open");
  try {
    for (const invoice of invoices ?? []) {
      if (!invoice.stripe_checkout_id) continue;
      const { data: account } = await paymentAdmin()
        .from("org_payment_accounts")
        .select("stripe_account_id")
        .eq("org_id", org.id)
        .single();
      if (!account) throw new Error();
      const stripe = teamStripe(),
        options = { stripeAccount: account.stripe_account_id };
      const session = await stripe.checkout.sessions.retrieve(
        invoice.stripe_checkout_id,
        {},
        options,
      );
      if (session.status === "complete")
        return {
          error:
            "An online payment is still processing. Wait for confirmation before canceling this plan.",
        };
      if (session.status === "open") await stripe.checkout.sessions.expire(session.id, {}, options);
    }
  } catch {
    return {
      error: "Open checkouts could not be closed. No balances were canceled; please try again.",
    };
  }
  const { error } = await supabase.rpc("cancel_team_payment_plan", {
    p_org: org.id,
    p_plan: planId,
  });
  if (error)
    return {
      error: "Unpaid balances could not be canceled. Check whether autopay is still active.",
    };
  refresh();
  return {};
}
