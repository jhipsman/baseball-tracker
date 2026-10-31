import { describe, expect, it } from "vitest";
import { bodyAlerts, isSpot, spotName, type BodyCheckin } from "./body";

const c = (date: string, feel: number, sore: string[] = []): BodyCheckin => ({
  date,
  feel,
  sore,
  sleep: null,
  note: null,
});
const T = "2026-11-10";

describe("body check-in", () => {
  it("validates and names spots", () => {
    expect(isSpot("knee:left")).toBe(true);
    expect(isSpot("chest")).toBe(true);
    expect(isSpot("knee")).toBe(false);
    expect(isSpot("chest:left")).toBe(false);
    expect(isSpot("tail")).toBe(false);
    expect(spotName("knee:left")).toBe("Left knee");
    expect(spotName("lower_back")).toBe("Lower back");
  });
  it("flags feeling rough and new soreness, keyed by day", () => {
    const a = bodyAlerts([c(T, 2, ["knee:left"]), c("2026-11-09", 4, ["lower_back"])], T);
    expect(a.map((x) => x.key)).toEqual([`feel:${T}`, `newsore:${T}`]);
    expect(a[1].message).toBe("New soreness: Left knee");
  });
  it("doesn't re-flag a spot that was already sore, but flags it lingering", () => {
    const a = bodyAlerts(
      [
        c(T, 4, ["hamstring:right"]),
        c("2026-11-09", 4, ["hamstring:right"]),
        c("2026-11-08", 4, ["hamstring:right"]),
      ],
      T,
    );
    expect(a.map((x) => x.key)).toEqual([`lingering:${T}`]);
  });
  it("ignores stale check-ins", () => {
    expect(bodyAlerts([c("2026-11-07", 1, ["neck"])], T)).toEqual([]);
  });
});
