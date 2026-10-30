import { beforeEach, describe, it, expect, vi } from "vitest";
import Stripe from "stripe";
const mocks = vi.hoisted(() => ({ handler: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/team-payment-webhook", () => ({ handleTeamPaymentEvent: mocks.handler }));
import { POST } from "@/app/api/payments/webhook/route";
const stripe = new Stripe("sk_test_local_fixture_only");
const secret = "whsec_local_fixture_only";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_local_fixture_only");
  vi.stubEnv("STRIPE_TEAM_WEBHOOK_SECRET", secret);
  mocks.handler.mockResolvedValue(undefined);
});
describe("team payment webhook verification", () => {
  it("rejects missing and invalid signatures without processing an event", async () => {
    const a = await POST(
      new Request("https://example.test/api/payments/webhook", { method: "POST", body: "{}" }),
    );
    expect(a.status).toBe(400);
    const b = await POST(
      new Request("https://example.test/api/payments/webhook", {
        method: "POST",
        body: "{}",
        headers: { "stripe-signature": "invalid" },
      }),
    );
    expect(b.status).toBe(400);
    expect(mocks.handler).not.toHaveBeenCalled();
  });
  it("accepts a correctly signed event and never trusts a checkout return URL", async () => {
    const body = JSON.stringify({
      id: "evt_test",
      type: "checkout.session.completed",
      data: { object: { payment_status: "unpaid" } },
      account: "acct_test",
    });
    const header = stripe.webhooks.generateTestHeaderString({ payload: body, secret });
    const r = await POST(
      new Request("https://example.test/api/payments/webhook", {
        method: "POST",
        body,
        headers: { "stripe-signature": header },
      }),
    );
    expect(r.status).toBe(200);
    expect(mocks.handler).toHaveBeenCalledWith(expect.objectContaining({ id: "evt_test" }));
  });
  it("returns a retryable error if a verified event could not be committed", async () => {
    mocks.handler.mockRejectedValue(new Error("database offline"));
    const body = JSON.stringify({ id: "evt_test", type: "invoice.paid", data: { object: {} } });
    const header = stripe.webhooks.generateTestHeaderString({ payload: body, secret });
    const r = await POST(
      new Request("https://example.test/api/payments/webhook", {
        method: "POST",
        body,
        headers: { "stripe-signature": header },
      }),
    );
    expect(r.status).toBe(500);
  });
});
