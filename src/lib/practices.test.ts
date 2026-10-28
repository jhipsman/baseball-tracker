import { describe, expect, it } from "vitest";
import {
  blockTimes,
  formatClock,
  formatDuration,
  formatTime12,
  normalizeStations,
  parseTime,
  practiceRange,
  toBlocksPayload,
  totalMinutes,
} from "./practices";

describe("parseTime", () => {
  it("reads HH:MM and HH:MM:SS", () => {
    expect(parseTime("15:30")).toBe(930);
    expect(parseTime("15:30:00")).toBe(930);
    expect(parseTime("7:05")).toBe(425);
  });
  it("rejects junk", () => {
    expect(parseTime(null)).toBeNull();
    expect(parseTime("")).toBeNull();
    expect(parseTime("25:00")).toBeNull();
    expect(parseTime("3pm")).toBeNull();
  });
});

describe("clock formatting", () => {
  it("formats 12-hour times", () => {
    expect(formatClock(930)).toBe("3:30");
    expect(formatClock(0)).toBe("12:00");
    expect(formatClock(725)).toBe("12:05");
    expect(formatTime12(930)).toBe("3:30 PM");
    expect(formatTime12(540)).toBe("9:00 AM");
    expect(formatTime12(720)).toBe("12:00 PM");
  });
  it("wraps past midnight", () => {
    expect(formatTime12(1440 + 30)).toBe("12:30 AM");
  });
  it("formats durations", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(120)).toBe("2h");
    expect(formatDuration(135)).toBe("2h 15m");
  });
});

describe("blockTimes", () => {
  const blocks = [{ durationMin: 15 }, { durationMin: 20 }, { durationMin: 25 }];

  it("runs a clock from the start time through cumulative durations", () => {
    const t = blockTimes("15:30:00", blocks);
    expect(t.map((b) => b.label)).toEqual(["3:30–3:45", "3:45–4:05", "4:05–4:30"]);
    expect(t[2]).toMatchObject({ start: 965, end: 990 });
  });

  it("counts elapsed time without a start time", () => {
    expect(blockTimes(null, blocks).map((b) => b.label)).toEqual([
      "0:00–0:15",
      "0:15–0:35",
      "0:35–1:00",
    ]);
  });

  it("crosses noon", () => {
    expect(blockTimes("11:50", [{ durationMin: 20 }])[0].label).toBe("11:50–12:10");
  });

  it("totals and ranges", () => {
    expect(totalMinutes(blocks)).toBe(60);
    expect(practiceRange("15:30", 120)).toBe("3:30 PM – 5:30 PM");
    expect(practiceRange(null, 120)).toBeNull();
  });
});

describe("normalizeStations", () => {
  it("keeps named stations and trims optional fields", () => {
    expect(
      normalizeStations([
        { name: " Infield ", coach: "Coach B", detail: "" },
        { name: "" },
        "junk",
        { name: "Cage", detail: "Front toss" },
      ]),
    ).toEqual([
      { name: "Infield", coach: "Coach B" },
      { name: "Cage", detail: "Front toss" },
    ]);
    expect(normalizeStations(null)).toEqual([]);
  });
});

describe("toBlocksPayload", () => {
  it("builds the RPC payload", () => {
    const r = toBlocksPayload([
      {
        kind: "hitting",
        title: " BP ",
        durationMin: 30,
        details: "",
        stations: [{ name: "Cage" }],
      },
    ]);
    expect(r).toEqual({
      payload: [
        {
          kind: "hitting",
          title: "BP",
          duration_min: 30,
          details: null,
          stations: [{ name: "Cage" }],
        },
      ],
    });
  });
  it("rejects missing titles and bad durations", () => {
    expect(
      toBlocksPayload([{ kind: "other", title: "", durationMin: 10, details: "", stations: [] }]),
    ).toEqual({ error: "Block 1 needs a title." });
    expect(
      toBlocksPayload([{ kind: "other", title: "X", durationMin: 0, details: "", stations: [] }]),
    ).toHaveProperty("error");
  });
});
