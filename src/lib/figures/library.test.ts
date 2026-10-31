import { describe, expect, it } from "vitest";
import { figureFor, FIGURE_NAMES } from "./library";
import { joints } from "./skeleton";

const which = (name: string) => {
  const f = figureFor(name);
  return f ? FIGURE_NAMES.find((n) => figureFor(n) === f) : null;
};

describe("figureFor", () => {
  it("finds library exercises by name, ignoring case and spacing", () => {
    expect(which("Band External Rotation")).toBe("band external rotation");
    expect(which("  JAEGER band forward fly ")).toBe("jaeger band forward fly");
  });
  it("matches coaches' own names when the move is the same", () => {
    expect(which("Banded ER")).toBe("band external rotation");
    expect(which("DB Goblet Squat")).toBe("goblet squat");
    expect(which("Chin-Up")).toBe("pull-up");
    expect(which("Hip Thrust")).toBe("glute bridge");
    expect(which("Catch Play Progression")).toBe("long toss");
  });
  it("draws nothing rather than the wrong move", () => {
    for (const n of [
      "Front Squat",
      "Split Squat Jump",
      "Deep Squat Hold",
      "Single-Leg RDL",
      "Lateral Lunge",
      "Plyo Push-Up",
      "Scap Push-Up",
      "Side-Lying External Rotation",
      "Prone 90/90 External Rotation",
      "Tee Work",
    ])
      expect(which(n), n).toBeNull();
  });
});

describe("skeleton", () => {
  it("keeps limb lengths in every pose", () => {
    for (const n of FIGURE_NAMES)
      for (const pose of figureFor(n)!.frames) {
        const j = joints(pose);
        const d = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
        expect(d(j.knee[0], j.ankle[0])).toBeCloseTo(20, 5);
        expect(d(j.hip, j.neck)).toBeCloseTo(26, 5);
      }
  });
});
