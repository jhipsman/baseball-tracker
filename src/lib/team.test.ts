import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
vi.mock("server-only", () => ({}));
import { loadTeam } from "./team";
function fixture() {
  const requests: { table: string; columns: string }[] = [];
  const client = {
    from(table: string) {
      let columns = "";
      const q = {
        select(c: string) {
          columns = c;
          return q;
        },
        eq: () => q,
        in: () => q,
        gte: () => q,
        lte: () => q,
        neq: () => q,
        order: () => q,
        limit: () => q,
        then(resolve: (value: unknown) => void) {
          requests.push({ table, columns });
          let data: unknown[] = [];
          if (table === "program_assignments")
            data = [
              {
                id: "a",
                player_id: "p",
                status: "active",
                start_date: "2026-10-26",
                program: {
                  id: "program",
                  name: "Training",
                  program_weeks: [
                    {
                      week_number: 1,
                      program_days: [
                        {
                          id: "d",
                          name: "Day 1",
                          day_number: 1,
                          day_of_week: 1,
                          session_type: "strength",
                          sort_order: 0,
                        },
                      ],
                    },
                  ],
                },
              },
            ];
          if (table === "org_memberships")
            data = [
              {
                profile_id: "p",
                position: null,
                jersey_number: 12,
                status: "active",
                profile: { full_name: "Alex", email: "alex@example.test" },
              },
            ];
          if (table === "workout_logs")
            data =
              columns === "player_id, date_completed"
                ? [{ player_id: "p", date_completed: "2026-10-26" }]
                : [
                    {
                      program_assignment_id: "a",
                      program_day_id: "d",
                      day_name: "Day 1",
                      status: "completed",
                      date_completed: "2026-10-26",
                    },
                  ];
          if (table === "player_groups")
            data = [{ id: "g", name: "Varsity", player_group_members: [{ profile_id: "p" }] }];
          return Promise.resolve({ data, error: null }).then(resolve);
        },
      };
      return q;
    },
  } as unknown as SupabaseClient<Database>;
  return { client, requests };
}
describe("lightweight dashboard roster reads", () => {
  it("preserves calendar/compliance entries while skipping unused groups and all-time history", async () => {
    const full = fixture(),
      lite = fixture();
    const args = ["org", "2026-10-23", "2026-10-29", "2026-10-29"] as const;
    const baseline = await loadTeam(full.client, ...args);
    const result = await loadTeam(lite.client, ...args, {
      includeGroups: false,
      includeLastLog: false,
    });
    expect(result.entries).toEqual(baseline.entries);
    expect(result.players).toEqual(baseline.players);
    expect(result.assignments).toEqual(baseline.assignments);
    expect(result.groups).toEqual([]);
    expect(result.lastLogDate.size).toBe(0);
    expect(lite.requests).toHaveLength(full.requests.length - 2);
    expect(
      lite.requests.some(
        (r) => r.table === "player_groups" || r.columns === "player_id, date_completed",
      ),
    ).toBe(false);
    expect(baseline.groups).toHaveLength(1);
    expect(baseline.lastLogDate.get("p")).toBe("2026-10-26");
  });
});
