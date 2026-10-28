import { describe, expect, it } from "vitest";
import { prescribedReps, summarize } from "./format";
import type { BuilderItem } from "./types";

const item = (o: Partial<BuilderItem>): BuilderItem => ({
  id: "a",
  exerciseId: "e",
  groupId: null,
  groupType: null,
  sets: null,
  reps: "",
  intensity: "",
  tempo: "",
  restSeconds: null,
  notes: "",
  ...o,
});

describe("summarize per tracking type", () => {
  it("keeps weight × reps prescriptions unchanged", () => {
    expect(summarize(item({ sets: 3, reps: "8", intensity: "75%", restSeconds: 90 }))).toBe(
      "3 × 8 · @ 75% · rest 1:30",
    );
  });

  it("reads time work naturally", () => {
    expect(summarize(item({ sets: 4, reps: "60 yd", restSeconds: 120 }), "time")).toBe(
      "4 × 60 yd · rest 2m",
    );
    expect(summarize(item({ sets: 3, reps: "30" }), "time")).toBe("3 × 30 s");
    expect(prescribedReps("30", "reps")).toBe("30");
  });

  it("passes distances through", () => {
    expect(summarize(item({ sets: 3, reps: "40 yd" }), "distance")).toBe("3 × 40 yd");
  });
});
