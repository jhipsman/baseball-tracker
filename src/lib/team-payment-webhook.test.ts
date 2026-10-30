import { beforeEach, describe, it, expect, vi } from "vitest";
import type Stripe from "stripe";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  fee: vi.fn(),
  subscriptionUpdate: vi.fn(),
  account: vi.fn(),
  accountError: vi.fn(),
  plan: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/stripe-team", () => ({
  stripeId: (v: string | { id: string } | null) => (typeof v === "string" ? v : (v?.id ?? null)),
  paymentAdmin: () => ({
    rpc: mocks.rpc,
    from: (table: string) => {
      const q = {
        select: () => q,
        eq: () => q,
        update: () => q,
        single: async () => ({ data: mocks.plan(), error: null }),
        maybeSingle: async () => ({
          data: table === "org_payment_accounts" ? mocks.account() : null,
          error: table === "org_payment_accounts" ? mocks.accountError() : null,
        }),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data: null, error: null }).then(resolve),
      };
      return q;
    },
  }),
  teamStripe: () => ({
    paymentIntents: { retrieve: mocks.fee },
    subscriptions: { update: mocks.subscriptionUpdate },
  }),
}));
import { handleTeamPaymentEvent } from "./team-payment-webhook";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.accountError.mockReturnValue(null);
  mocks.account.mockReturnValue({ org_id: "org", stripe_account_id: "acct_team" });
  mocks.plan.mockReturnValue({ id: "plan", first_due: "2027-01-31", installments: 3 });
  mocks.rpc.mockResolvedValue({ data: "invoice", error: null });
  mocks.fee.mockResolvedValue({ latest_charge: { balance_transaction: { fee: 320 } } });
  mocks.subscriptionUpdate.mockResolvedValue({});
});
function event(object: unknown, type = "checkout.session.completed") {
  return { id: "evt_one", account: "acct_team", type, data: { object } } as Stripe.Event;
}
describe("connected-account payment reconciliation", () => {
  it("asks Stripe to retry when account lookup fails instead of dropping a verified event", async () => {
    mocks.accountError.mockReturnValue(new Error("Database unavailable"));
    await expect(handleTeamPaymentEvent(event({}))).rejects.toThrow("Database unavailable");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not mark an unpaid checkout or wrong-organization session as paid", async () => {
    await handleTeamPaymentEvent(
      event({
        mode: "payment",
        payment_status: "unpaid",
        metadata: { org_id: "org", team_invoice_id: "invoice" },
      }),
    );
    await handleTeamPaymentEvent(
      event({
        mode: "payment",
        payment_status: "paid",
        metadata: { org_id: "other", team_invoice_id: "invoice" },
      }),
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("records only a settled payment using the verified account organization", async () => {
    await handleTeamPaymentEvent(
      event({
        mode: "payment",
        payment_status: "paid",
        amount_total: 10000,
        payment_intent: "pi_one",
        metadata: { org_id: "org", team_invoice_id: "invoice" },
      }),
    );
    expect(mocks.rpc).toHaveBeenCalledWith(
      "apply_team_stripe_payment",
      expect.objectContaining({
        p_org: "org",
        p_invoice: "invoice",
        p_cents: 10000,
        p_provider: "pi_one",
        p_fee: 320,
      }),
    );
  });
  it("ignores unrelated Stripe accounts", async () => {
    mocks.account.mockReturnValue(null);
    await handleTeamPaymentEvent(event({ mode: "payment", payment_status: "paid" }));
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("places a finite stop date on installment subscriptions", async () => {
    await handleTeamPaymentEvent(
      event({
        mode: "subscription",
        subscription: "sub_one",
        metadata: { org_id: "org", team_plan_id: "plan" },
      }),
    );
    expect(mocks.subscriptionUpdate).toHaveBeenCalledWith(
      "sub_one",
      {
        cancel_at: Math.floor(Date.parse("2027-03-31T12:00:00Z") / 1000) + 14 * 86400,
        proration_behavior: "none",
      },
      { stripeAccount: "acct_team" },
    );
  });
  it("fails for retry instead of dropping a database error", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "offline" } });
    await expect(
      handleTeamPaymentEvent(
        event({
          mode: "payment",
          payment_status: "paid",
          amount_total: 10000,
          payment_intent: "pi_one",
          metadata: { org_id: "org", team_invoice_id: "invoice" },
        }),
      ),
    ).rejects.toThrow("recorded");
  });
});
