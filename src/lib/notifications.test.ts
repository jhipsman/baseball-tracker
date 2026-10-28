import { describe, expect, it } from "vitest";
import { homeFor, hrefForRole, isSafeRelative, kindsForRole } from "./notifications";

describe("hrefForRole", () => {
  it("leaves staff links unchanged", () => {
    for (const role of ["admin", "coach", "trainer"] as const) {
      expect(hrefForRole("/messages?a=abc", role)).toBe("/messages?a=abc");
      expect(hrefForRole("/messages/t1", role)).toBe("/messages/t1");
      expect(hrefForRole("/videos/v1", role)).toBe("/videos/v1");
      expect(hrefForRole("/throwing", role)).toBe("/throwing");
      expect(hrefForRole("/practices/p1", role)).toBe("/practices/p1");
    }
  });

  it("maps player links", () => {
    expect(hrefForRole("/messages?a=abc", "player")).toBe("/player/messages?a=abc");
    expect(hrefForRole("/messages/t1", "player")).toBe("/player/messages/t1");
    expect(hrefForRole("/messages", "player")).toBe("/player/messages");
    expect(hrefForRole("/practices/p1", "player")).toBe("/player/practices/p1");
    expect(hrefForRole("/player/videos/v1", "player")).toBe("/player/videos/v1");
    expect(hrefForRole("/player", "player")).toBe("/player");
    expect(hrefForRole("/parent/videos/v1", "player")).toBe("/player/videos/v1");
  });

  it("maps parent links", () => {
    expect(hrefForRole("/messages?a=abc", "parent")).toBe("/parent/messages?a=abc");
    expect(hrefForRole("/messages/t1", "parent")).toBe("/parent/messages/t1");
    expect(hrefForRole("/practices/p1", "parent")).toBe("/parent/practices/p1");
    expect(hrefForRole("/player/videos/v1", "parent")).toBe("/parent/videos/v1");
    expect(hrefForRole("/parent/videos/v1", "parent")).toBe("/parent/videos/v1");
    expect(hrefForRole("/parent", "parent")).toBe("/parent");
    expect(hrefForRole("/player", "parent")).toBe("/parent");
  });

  it("only matches whole path segments", () => {
    expect(hrefForRole("/messagesx", "player")).toBe("/messagesx");
    expect(hrefForRole("/practicesfoo", "parent")).toBe("/practicesfoo");
    expect(hrefForRole("/playerville", "parent")).toBe("/playerville");
  });

  it("never redirects off-site", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "evil.com", "", null]) {
      expect(hrefForRole(bad, "coach")).toBe("/");
      expect(hrefForRole(bad, "player")).toBe("/player");
      expect(hrefForRole(bad, "parent")).toBe("/parent");
    }
    expect(hrefForRole("/x\n//evil.com", "coach")).toBe("/");
  });
});

describe("helpers", () => {
  it("homeFor", () => {
    expect(homeFor("coach")).toBe("/");
    expect(homeFor("player")).toBe("/player");
    expect(homeFor("parent")).toBe("/parent");
  });

  it("isSafeRelative", () => {
    expect(isSafeRelative("/a")).toBe(true);
    expect(isSafeRelative("//a")).toBe(false);
  });

  it("kindsForRole", () => {
    expect(kindsForRole("coach").map((k) => k.key)).toContain("video_uploaded");
    expect(kindsForRole("player").map((k) => k.key)).not.toContain("video_uploaded");
    expect(kindsForRole("parent").map((k) => k.key)).toContain("arm_pain");
  });
});
