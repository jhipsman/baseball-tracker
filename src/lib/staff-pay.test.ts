import { describe, expect, it } from "vitest";
import {
  entryAmount,
  entryMinutes,
  hours,
  parseDollars,
  periodPresets,
  periodTotals,
  stipendPayment,
  toCsv,
  type Entry,
  type Rate,
} from "./staff-pay";

const e = (p: Partial<Entry>): Entry => ({
  profile_id: "a",
  kind: "shift",
  minutes: 60,
  started_at: null,
  ended_at: null,
  status: "approved",
  amount_cents: null,
  ...p,
});
const hourly: Rate = {
  pay_type: "hourly",
  rate_cents: 2000,
  stipend_cents: 0,
  stipend_payments: 1,
};
const perSession: Rate = {
  pay_type: "per_session",
  rate_cents: 5000,
  stipend_cents: 0,
  stipend_payments: 1,
};
const stipend: Rate = {
  pay_type: "stipend",
  rate_cents: 0,
  stipend_cents: 100000,
  stipend_payments: 3,
};

describe("staff pay", () => {
  it("prices time by pay type", () => {
    expect(entryAmount(e({ minutes: 90 }), hourly)).toBe(3000);
    expect(entryAmount(e({ kind: "session", minutes: 120 }), perSession)).toBe(5000);
    expect(entryAmount(e({}), stipend)).toBe(0);
    expect(entryAmount(e({}), undefined)).toBe(0);
  });
  it("keeps the amount fixed at approval even if the rate changes", () => {
    expect(entryAmount(e({ amount_cents: 1234 }), hourly)).toBe(1234);
    expect(entryAmount(e({ status: "submitted", amount_cents: 1234, minutes: 30 }), hourly)).toBe(
      1000,
    );
  });
  it("counts a running clock up to now", () => {
    const now = new Date("2026-11-03T18:45:00Z");
    expect(
      entryMinutes({ minutes: null, started_at: "2026-11-03T17:00:00Z", ended_at: null }, now),
    ).toBe(105);
  });
  it("splits a stipend evenly, the last payment taking the remainder", () => {
    expect([1, 2, 3, 4].map((n) => stipendPayment(stipend, n))).toEqual([33333, 33333, 33334, 0]);
    expect(stipendPayment(hourly)).toBe(0);
  });
  it("totals a period: approved time pays, waiting time shows separately, sent-back time is ignored", () => {
    const rates = new Map<string, Rate>([
      ["a", hourly],
      ["b", stipend],
    ]);
    const [a, b] = periodTotals(
      ["a", "b"],
      [
        e({ minutes: 120 }),
        e({ minutes: 60, status: "submitted" }),
        e({ minutes: 600, status: "rejected" }),
        e({ profile_id: "b", minutes: 180 }),
      ],
      rates,
    );
    expect(a).toMatchObject({
      minutes: 180,
      approvedCents: 4000,
      pendingCents: 2000,
      pendingCount: 1,
      payCents: 4000,
    });
    expect(b).toMatchObject({
      minutes: 180,
      approvedCents: 0,
      stipendCents: 33333,
      payCents: 33333,
    });
  });
  it("formats hours and reads dollar amounts", () => {
    expect([hours(45), hours(60), hours(390)]).toEqual(["45m", "1h", "6h 30m"]);
    expect([
      parseDollars("$18.50"),
      parseDollars("20"),
      parseDollars(""),
      parseDollars("abc"),
    ]).toEqual([1850, 2000, 0, null]);
  });
  it("offers pay periods from Monday weeks and calendar months", () => {
    const p = Object.fromEntries(periodPresets("2026-11-04").map((x) => [x.key, [x.from, x.to]]));
    expect(p["this-week"]).toEqual(["2026-11-02", "2026-11-08"]);
    expect(p["last-2-weeks"]).toEqual(["2026-10-19", "2026-11-01"]);
    expect(p["this-month"]).toEqual(["2026-11-01", "2026-11-30"]);
    expect(p["last-month"]).toEqual(["2026-10-01", "2026-10-31"]);
  });
  it("quotes CSV cells that need it", () => {
    expect(
      toCsv([
        ["Name", "Note"],
        ["Dee, Coach", 'said "hi"'],
      ]),
    ).toBe('Name,Note\n"Dee, Coach","said ""hi"""');
  });
});
