import { describe, expect, it } from "vitest";
import { activeTab, COACH_SECTIONS, isUnder, visibleTabs } from "./sections";

const team = COACH_SECTIONS.find((s) => s.key === "team")!;
const schedule = COACH_SECTIONS.find((s) => s.key === "schedule")!;
const health = COACH_SECTIONS.find((s) => s.key === "health")!;

describe("sections", () => {
  it("matches on segment boundaries", () => {
    expect(isUnder("/roster/abc", "/roster")).toBe(true);
    expect(isUnder("/rosterx", "/roster")).toBe(false);
    expect(isUnder("/", "/")).toBe(true);
    expect(isUnder("/games", "/")).toBe(false);
  });
  it("picks the most specific tab", () => {
    expect(activeTab("/roster/manage", team.tabs)?.label).toBe("Members & invites");
    expect(activeTab("/roster/123", team.tabs)?.label).toBe("Roster");
    expect(activeTab("/stats", team.tabs)?.label).toBe("Stats");
  });
  it("hides tabs and sections for turned-off features", () => {
    expect(visibleTabs(schedule, ["health"]).map((t) => t.label)).toEqual(["Calendar"]);
    expect(visibleTabs(team, ["games"]).map((t) => t.label)).toContain("Stats");
    expect(visibleTabs(health, ["games"])).toEqual([]);
    expect(visibleTabs(health, null).map((t) => t.label)).toEqual(["Today", "Workload & logs"]);
  });
});
