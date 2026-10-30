import { describe, it, expect } from "vitest";
import { readCents, installmentDates, invoiceBalance, readPaymentPlan } from "./team-payments";
describe("installment accounting", () => {
  it("parses money exactly in cents and rejects ambiguous or excessive amounts", () => {
    expect(readCents("100.05")).toBe(10005);
    expect(readCents("0.10")).toBe(10);
    for (const value of ["-1", "1e2", "NaN", "1.005", "1000000", "1,000.00", ""])
      expect(readCents(value)).toBeNull();
  });
  it("preserves the original month-end anchor through leap years", () => {
    expect(installmentDates("2028-01-31", 3)).toEqual(["2028-01-31", "2028-02-29", "2028-03-31"]);
    expect(installmentDates("2027-12-30", 3)).toEqual(["2027-12-30", "2028-01-30", "2028-02-29"]);
    expect(installmentDates("2027-02-30", 2)).toEqual([]);
    expect(installmentDates("2027-01-01", 25)).toEqual([]);
  });
  it("does not reopen settled or refunded obligations", () => {
    expect(invoiceBalance({ amount_cents: 10000, paid_cents: 4000, status: "open" })).toBe(6000);
    expect(invoiceBalance({ amount_cents: 10000, paid_cents: 4000, status: "void" })).toBe(0);
    expect(invoiceBalance({ amount_cents: 10000, paid_cents: 10000, status: "refunded" })).toBe(0);
  });
  it("validates plan input and requires an idempotency key", () => {
    const fd = new FormData();
    Object.entries({
      title: "Team dues",
      season: "2027",
      amount: "100.00",
      count: "6",
      first_due: "2027-01-31",
      payer_id: "10000000-0000-4000-8000-000000000001",
      request_id: "20000000-0000-4000-8000-000000000001",
    }).forEach(([k, v]) => fd.set(k, v));
    expect(readPaymentPlan(fd)).toMatchObject({ count: 6, cents: 10000, date: "2027-01-31" });
    fd.delete("request_id");
    expect(readPaymentPlan(fd)).toHaveProperty("error");
  });
});
