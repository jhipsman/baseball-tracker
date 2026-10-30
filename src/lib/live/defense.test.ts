import { describe, expect, it } from "vitest";
import type { Play } from "./engine";
import { defaultDefense, nearestFielder, opponentLabel, opponentOrder } from "./defense";

const pos: Record<string, string> = {
  a: "SS",
  b: "OF",
  c: "OF",
  d: "C",
  e: "P",
  f: "UTIL",
  g: "SS",
};

describe("defaultDefense", () => {
  it("puts the starter on the mound and players at their roster spots", () => {
    const d = defaultDefense(["a", "b", "c", "d", "e", "f", "g"], "e", (id) => pos[id]);
    expect(d).toMatchObject({ P: "e", SS: "a", CF: "b", LF: "c", C: "d" });
    // Everyone left fills the open spots in batting order; nobody plays twice.
    expect(new Set(Object.values(d)).size).toBe(Object.values(d).length);
    expect(Object.values(d)).toEqual(expect.arrayContaining(["f", "g"]));
  });
  it("leaves spots empty when the lineup is short", () => {
    expect(Object.keys(defaultDefense(["a"], null, (id) => pos[id]))).toEqual(["SS"]);
  });
});

describe("nearestFielder", () => {
  it("names who was closest to the tap", () => {
    expect(nearestFielder(0.42, 0.52)).toBe("SS");
    expect(nearestFielder(0.5, 0.15)).toBe("CF");
    expect(nearestFielder(0.8, 0.7)).toBe("1B");
  });
});

describe("opponentOrder", () => {
  const pa = (seq: number, weBat: boolean) => ({ seq, kind: "pa", weBat }) as Play;
  it("walks through their order and wraps around", () => {
    const o = opponentOrder({ oppLineup: ["#4", "", "Smith"] }, [
      pa(1, false),
      pa(2, true),
      pa(3, false),
      pa(4, false),
      pa(5, false),
    ]);
    expect([...o.slots.values()]).toEqual([0, 1, 2, 0]);
    expect(o.next).toBe(1);
    expect(opponentLabel({ oppLineup: ["#4", "", "Smith"] }, 1)).toBe("Batter 2");
    expect(opponentLabel({ oppLineup: ["#4", "", "Smith"] }, 2)).toBe("Smith");
  });
  it("assumes nine unnamed batters", () => {
    expect(opponentOrder(null, []).size).toBe(9);
    expect(opponentLabel(null, 0)).toBe("Batter 1");
  });
});
