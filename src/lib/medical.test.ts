import { describe, expect, it } from "vitest";
import { isNone, parseContacts, telHref } from "./medical";

describe("medical card", () => {
  it("makes tap-to-call links", () => {
    expect(telHref("(555) 123-4567")).toBe("tel:5551234567");
    expect(telHref("+1 555.123.4567 ext 9")).toBe("tel:+15551234567");
    expect(telHref("call mom")).toBeNull();
  });
  it("keeps up to 3 real contacts", () => {
    expect(
      parseContacts([{ name: " Ann ", phone: "555", relation: "Mom" }, { name: "" }, 5, null]),
    ).toEqual([{ name: "Ann", phone: "555", relation: "Mom" }]);
    expect(parseContacts("x")).toEqual([]);
  });
  it("treats 'none' as nothing to flag", () => {
    expect(["None", "n/a", "N/A.", "", null].every(isNone)).toBe(true);
    expect(isNone("Peanuts")).toBe(false);
  });
});
