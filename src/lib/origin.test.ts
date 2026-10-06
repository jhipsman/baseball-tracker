import { describe, expect, it } from "vitest";
import { resolveOrigin } from "./origin";

const headers = (map: Record<string, string>) => ({ get: (k: string) => map[k] ?? null });
const deploymentHost = headers({
  "x-forwarded-host": "baseball-tracker-git-claude-x-jhipsman.vercel.app",
  "x-forwarded-proto": "https",
});

describe("resolveOrigin", () => {
  it("prefers NEXT_PUBLIC_SITE_URL and normalizes it", () => {
    expect(resolveOrigin({ NEXT_PUBLIC_SITE_URL: "https://train.team.com/" }, deploymentHost)).toBe(
      "https://train.team.com",
    );
    expect(
      resolveOrigin({ NEXT_PUBLIC_SITE_URL: " baseball-tracker-tau.vercel.app " }, deploymentHost),
    ).toBe("https://baseball-tracker-tau.vercel.app");
  });

  it("uses Vercel's production domain instead of a protected deployment URL", () => {
    expect(
      resolveOrigin(
        { VERCEL_PROJECT_PRODUCTION_URL: "baseball-tracker-tau.vercel.app" },
        deploymentHost,
      ),
    ).toBe("https://baseball-tracker-tau.vercel.app");
  });

  it("falls back to the request host locally", () => {
    expect(resolveOrigin({}, headers({ host: "localhost:3000" }))).toBe("http://localhost:3000");
    expect(resolveOrigin({}, headers({ host: "192.168.1.20:3000" }))).toBe(
      "http://192.168.1.20:3000",
    );
  });
});
