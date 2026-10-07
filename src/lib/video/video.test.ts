import { describe, expect, it } from "vitest";
import { analysisToText, parseAnalysis } from "./analysis";
import { angleAt, formatClock, isVisibleAt, sampleTimes, simplify, tiltOf } from "./geometry";

describe("geometry", () => {
  it("measures the angle at a vertex", () => {
    expect(angleAt([1, 0], [0, 0], [0, 1])).toBeCloseTo(90);
    expect(angleAt([1, 0], [0, 0], [-1, 0])).toBeCloseTo(180);
    expect(angleAt([1, 0], [0, 0], [1, 1])).toBeCloseTo(45);
    expect(angleAt([0, 0], [0, 0], [1, 1])).toBe(0);
  });
  it("accounts for the frame's aspect ratio", () => {
    // In a 16:9 frame, normalized (0.5, 0.5) from the vertex is not 45°.
    const a = angleAt([0.5, 0], [0, 0], [0.5, 0.5], 16 / 9);
    expect(a).toBeCloseTo((Math.atan(0.5 / ((0.5 * 16) / 9)) * 180) / Math.PI);
  });
  it("measures tilt from horizontal", () => {
    expect(tiltOf([0, 0], [1, 1])).toBeCloseTo(45);
    expect(tiltOf([0, 0.5], [1, 0.5])).toBe(0);
  });
  it("simplifies freehand strokes but keeps the endpoint", () => {
    const pts: [number, number][] = [
      [0, 0],
      [0.001, 0],
      [0.002, 0],
      [0.1, 0],
      [0.1005, 0],
    ];
    expect(simplify(pts)).toEqual([
      [0, 0],
      [0.1, 0],
      [0.1005, 0],
    ]);
  });
  it("shows drawings around their timestamp", () => {
    expect(isVisibleAt(2, 2, 1.5)).toBe(true);
    expect(isVisibleAt(2, 3.4, 1.5)).toBe(true);
    expect(isVisibleAt(2, 3.6, 1.5)).toBe(false);
    expect(isVisibleAt(2, 1.5, 1.5)).toBe(false);
  });
  it("formats clock time", () => {
    expect(formatClock(0)).toBe("0:00.0");
    expect(formatClock(65.34)).toBe("1:05.3");
  });
  it("samples evenly within a window", () => {
    expect(sampleTimes(1, 2.05, 3)).toEqual([1, 1.5, 2]);
    expect(sampleTimes(0, 0, 8)).toEqual([0]);
    expect(sampleTimes(4, 2, 2)).toEqual([2, 3.95]);
  });
});

describe("AI analysis", () => {
  it("validates and trims model output", () => {
    const a = parseAnalysis({
      summary: " Solid swing. ",
      phases: [{ name: "Load", time_s: "0.4", notes: "Hands set" }, { name: "" }],
      strengths: ["Balanced", 5],
      improvements: [1, 2, 3, 4].map((n) => ({
        title: `T${n}`,
        detail: "d",
        cue: "c",
        drill: "x",
      })),
      confidence: "bogus",
      limitations: "Side view only",
    });
    expect(a?.summary).toBe("Solid swing.");
    expect(a?.phases).toEqual([{ name: "Load", time_s: 0.4, notes: "Hands set" }]);
    expect(a?.strengths).toEqual(["Balanced"]);
    expect(a?.improvements).toHaveLength(3);
    expect(a?.confidence).toBe("low");
    expect(parseAnalysis({ summary: "" })).toBeNull();
    expect(parseAnalysis("x")).toBeNull();
  });
  it("renders editable text", () => {
    const text = analysisToText({
      summary: "Good.",
      phases: [],
      strengths: ["Balance"],
      improvements: [
        {
          title: "Early hips",
          detail: "Hips open early.",
          cue: "Stay closed",
          drill: "Wall drill",
        },
      ],
      confidence: "medium",
      limitations: "",
    });
    expect(text).toContain("• Balance");
    expect(text).toContain("1. Early hips: Hips open early.");
    expect(text).toContain('Cue: "Stay closed"');
  });
});
