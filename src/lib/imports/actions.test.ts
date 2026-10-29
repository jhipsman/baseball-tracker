import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ org: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/org", () => ({ requireActiveOrg: mocks.org }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { saveImport } from "@/app/(dashboard)/imports/actions";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.org.mockResolvedValue({
    org: { id: "org" },
    membership: { role: "admin" },
    supabase: { rpc: mocks.rpc },
  });
  mocks.rpc.mockResolvedValue({ data: { saved: 1, skipped: 0 }, error: null });
});
describe("import confirmation boundary", () => {
  it("checks admin permission before saving", async () => {
    mocks.org.mockResolvedValue({ membership: { role: "coach" } });
    expect(
      await saveImport({
        kind: "roster",
        source: "excel",
        season: "2026",
        rows: [{ name: "Alex" }],
      }),
    ).toHaveProperty("error");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("revalidates client rows before calling the atomic RPC", async () => {
    expect(
      await saveImport({
        kind: "schedule",
        source: "sheets",
        season: "2026",
        rows: [{ opponent: "Tigers", date: "2026-02-30" }],
      }),
    ).toHaveProperty("error");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("normalizes input, removes exact duplicates and uses only the active org", async () => {
    const result = await saveImport({
      kind: "roster",
      source: "gamechanger",
      season: "2026",
      rows: [{ name: "Alex" }, { name: "Alex" }],
    });
    expect(result).toEqual({ saved: 1, skipped: 1 });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "import_team_rows",
      expect.objectContaining({
        p_org: "org",
        p_rows: [{ key: "name:alex", values: { name: "Alex" } }],
      }),
    );
  });
  it("reports a failed transaction without claiming success", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "failed" } });
    expect(
      await saveImport({
        kind: "roster",
        source: "excel",
        season: "2026",
        rows: [{ name: "Alex" }],
      }),
    ).toHaveProperty("error");
  });
});
