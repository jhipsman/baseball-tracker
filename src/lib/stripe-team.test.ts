import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import type Stripe from "stripe";
import { createTeamAccount, teamAccountReady, teamOnboardingLink } from "./stripe-team";

const fake = (over: Record<string, unknown>) => over as unknown as Stripe;
const urls = {
  refresh: "https://9dbsbl.app/dues?setup=retry",
  back: "https://9dbsbl.app/dues?setup=returned",
};

describe("team Stripe accounts (v2)", () => {
  it("creates the account with Stripe covering losses and fees, full dashboard", async () => {
    const create = vi.fn().mockResolvedValue({ id: "acct_1" });
    await createTeamAccount(
      fake({ v2: { core: { accounts: { create } } } }),
      { orgId: "org", name: "Rays", email: "c@x.com" },
      "k",
    );
    const [params, opts] = create.mock.calls[0];
    expect(params.defaults.responsibilities).toEqual({
      fees_collector: "stripe",
      losses_collector: "stripe",
    });
    expect(params.dashboard).toBe("full");
    expect(params.configuration.merchant.capabilities.card_payments).toEqual({ requested: true });
    expect(params).not.toHaveProperty("type");
    expect(opts).toEqual({ idempotencyKey: "k" });
  });

  it("is ready when card payments are active, and falls back to v1 for older accounts", async () => {
    const v2 = (status: string) =>
      fake({
        v2: {
          core: {
            accounts: {
              retrieve: vi.fn().mockResolvedValue({
                configuration: { merchant: { capabilities: { card_payments: { status } } } },
              }),
            },
          },
        },
      });
    expect(await teamAccountReady(v2("active"), "acct")).toBe(true);
    expect(await teamAccountReady(v2("pending"), "acct")).toBe(false);
    const v1 = fake({
      v2: { core: { accounts: { retrieve: vi.fn().mockRejectedValue(new Error("not v2")) } } },
      accounts: { retrieve: vi.fn().mockResolvedValue({ charges_enabled: true }) },
    });
    expect(await teamAccountReady(v1, "acct")).toBe(true);
  });

  it("onboarding link: v2 with configurations, retries without if Stripe rejects it", async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(
        new Error("Received unknown parameter: use_case[account_onboarding][configurations]"),
      )
      .mockResolvedValueOnce({ url: "https://connect.stripe.com/x" });
    const url = await teamOnboardingLink(
      fake({ v2: { core: { accountLinks: { create } } } }),
      "acct",
      urls,
    );
    expect(url).toBe("https://connect.stripe.com/x");
    expect(create.mock.calls[0][0].use_case.account_onboarding.configurations).toEqual([
      "merchant",
    ]);
    expect(create.mock.calls[1][0].use_case.account_onboarding).not.toHaveProperty(
      "configurations",
    );
    expect(create.mock.calls[1][0].use_case.account_onboarding.return_url).toBe(urls.back);
  });

  it("onboarding link: older v1 accounts use v1 Account Links", async () => {
    const v1 = vi.fn().mockResolvedValue({ url: "https://connect.stripe.com/v1" });
    const url = await teamOnboardingLink(
      fake({
        v2: {
          core: {
            accountLinks: { create: vi.fn().mockRejectedValue(new Error("This is a v1 account")) },
          },
        },
        accountLinks: { create: v1 },
      }),
      "acct",
      urls,
    );
    expect(url).toBe("https://connect.stripe.com/v1");
    expect(v1.mock.calls[0][0]).toMatchObject({ account: "acct", type: "account_onboarding" });
  });
});
