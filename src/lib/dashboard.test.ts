import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
const mocks = vi.hoisted(() => ({
  team: vi.fn(),
  throwing: vi.fn(),
  births: vi.fn(),
  videos: vi.fn(),
  practices: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/team", () => ({ loadTeam: mocks.team }));
vi.mock("@/lib/throwing", () => ({ loadThrowing: mocks.throwing, loadBirthDates: mocks.births }));
vi.mock("@/lib/videos", () => ({ pendingVideoCount: mocks.videos }));
vi.mock("@/lib/practices", () => ({ loadPractices: mocks.practices }));
import { loadDashboard } from "./dashboard";

const team = { players: [], groups: [], assignments: [], entries: [], lastLogDate: new Map() };
let started: string[];
let releases: (() => void)[];
function gate<T>(name: string, value: T): Promise<T> {
  started.push(name);
  return new Promise((resolve) => releases.push(() => resolve(value)));
}
function client() {
  return {
    from(table: string) {
      const q = {
        select: () => q,
        eq: () => q,
        order: () => q,
        limit: () => q,
        then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
          gate(table, { data: [{ id: "row" }], count: 3 }).then(resolve, reject),
      };
      return q;
    },
  } as unknown as SupabaseClient<Database>;
}
beforeEach(() => {
  started = [];
  releases = [];
  vi.clearAllMocks();
  mocks.team.mockImplementation(() => gate("team", team));
  mocks.throwing.mockImplementation(() => gate("throwing", []));
  mocks.births.mockImplementation(() => gate("births", new Map()));
  mocks.videos.mockImplementation(() => gate("videos", 2));
  mocks.practices.mockImplementation(() => gate("practices", [{ id: "next" }]));
});

describe("dashboard critical path", () => {
  it("starts every independent read before any data source finishes", async () => {
    const data = loadDashboard(client(), { id: "org", modules: null }, "2026-10-29");
    await Promise.resolve();
    await Promise.resolve();
    expect(started.sort()).toEqual(
      [
        "team",
        "throwing",
        "births",
        "videos",
        "practices",
        "workout_logs",
        "exercises",
        "org_memberships",
        "programs",
        "program_assignments",
        "assessments",
      ].sort(),
    );
    expect(mocks.team).toHaveBeenCalledWith(
      expect.anything(),
      "org",
      "2026-10-23",
      "2026-10-29",
      "2026-10-29",
      { includeGroups: false, includeLastLog: false },
    );
    releases.forEach((release) => release());
    expect(await data).toMatchObject({
      team,
      videosToReview: 2,
      nextPractice: { id: "next" },
      assignmentCount: 1,
      assessmentCount: 1,
    });
  });
  it("does not request health, video or practice data for disabled modules", async () => {
    const data = loadDashboard(client(), { id: "org", modules: [] }, "2026-10-29");
    await Promise.resolve();
    await Promise.resolve();
    expect(mocks.throwing).not.toHaveBeenCalled();
    expect(mocks.births).not.toHaveBeenCalled();
    expect(mocks.videos).not.toHaveBeenCalled();
    expect(mocks.practices).not.toHaveBeenCalled();
    releases.forEach((release) => release());
    expect(await data).toMatchObject({
      throwRows: [],
      births: new Map(),
      videosToReview: 0,
      nextPractice: undefined,
    });
  });
  it("propagates a failed workload read rather than displaying a falsely healthy team", async () => {
    mocks.throwing.mockRejectedValue(new Error("workload unavailable"));
    const data = loadDashboard(client(), { id: "org", modules: ["health"] }, "2026-10-29");
    const failure = expect(data).rejects.toThrow("workload unavailable");
    await Promise.resolve();
    releases.forEach((release) => release());
    await failure;
  });
});
