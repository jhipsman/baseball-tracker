import { describe, expect, it } from "vitest";
import {
  guessMapping,
  mapRows,
  normalizeDate,
  normalizeTime,
  parseCsv,
  validateRows,
} from "./parse";
describe("spreadsheet imports", () => {
  it("reads quoted commas, embedded newlines, escaped quotes and a BOM", () => {
    expect(
      parseCsv('\uFEFFPlayer Name,Position\r\n"Sam, Jr.","P\nOF"\r\n"Alex ""Ace""",SS'),
    ).toEqual([
      ["Player Name", "Position"],
      ["Sam, Jr.", "P\nOF"],
      ['Alex "Ace"', "SS"],
    ]);
    expect(() => parseCsv('Name\n"unfinished')).toThrow("closing quote");
  });
  it("matches a Sheets roster and combines split names without requiring emails", () => {
    const grid = parseCsv("First Name,Last Name,Jersey Number\nAlex,Rivera,12");
    const checked = validateRows("roster", mapRows(grid, guessMapping(grid[0], "roster")), "2026");
    expect(checked.errors).toEqual([]);
    expect(checked.rows[0].values).toMatchObject({ name: "Alex Rivera", jersey: "12" });
  });
  it("deduplicates identical rows and blocks conflicting player identities", () => {
    expect(validateRows("roster", [{ name: "Alex" }, { name: "Alex" }], "2026").duplicates).toBe(1);
    expect(
      validateRows(
        "roster",
        [
          { name: "Alex", jersey: "1" },
          { name: "Alex", jersey: "2" },
        ],
        "2026",
      ).errors,
    ).toHaveLength(1);
    expect(
      validateRows(
        "roster",
        [
          { name: "Alex", external_id: "a" },
          { name: "Alex", external_id: "b" },
        ],
        "2026",
      ).errors,
    ).toEqual([]);
  });
  it("validates real dates and explicitly converts local US dates and times", () => {
    expect(normalizeDate("2/29/2025")).toBeNull();
    expect(normalizeDate("2/29/2024")).toBe("2024-02-29");
    expect(normalizeTime("6:30 PM")).toBe("18:30");
    expect(normalizeTime("12:00 AM")).toBe("00:00");
    expect(normalizeTime("25:00")).toBeNull();
    expect(
      validateRows(
        "schedule",
        [{ opponent: "Tigers", date: "10/29/2026", time: "6:30 PM", home_away: "A" }],
        "2026",
      ).rows[0].values,
    ).toMatchObject({ date: "2026-10-29", time: "18:30", home_away: "away" });
  });
  it("preserves baseball IP and season provenance without interpreting IP as decimal innings", () => {
    const valid = validateRows(
      "stats",
      [{ name: "Alex", IP: "12.2", H: "4", AB: "10", AVG: ".400" }],
      "2025 Spring",
    );
    expect(valid.errors).toEqual([]);
    expect(valid.rows[0].values).toMatchObject({ IP: "12.2", season: "2025 Spring", AVG: ".400" });
    expect(
      validateRows("stats", [{ name: "Alex", IP: "12.5", H: "11", AB: "10" }], "2025").errors,
    ).toHaveLength(2);
    expect(
      validateRows("stats", [{ name: "Alex", HR: "=IMPORTXML(secret)" }], "2025").errors.length,
    ).toBeGreaterThan(0);
  });
  it("rejects missing required fields and limits file size/row count", () => {
    expect(
      validateRows("schedule", [{ date: "2026-01-01" }], "2026").errors.length,
    ).toBeGreaterThan(0);
    expect(validateRows("stats", [{ name: "Alex" }], "2026").errors).toContain(
      "Row 2: Map at least one supported statistic.",
    );
    expect(() => parseCsv("a\n".repeat(1002))).toThrow("1,000");
  });
  it("keeps batting and pitching snapshots distinct and maps Excel date/time cells", () => {
    const checked = validateRows(
      "stats",
      [
        { name: "Alex", category: "batting", H: "4" },
        { name: "Alex", category: "pitching", IP: "12.2" },
      ],
      "2026",
    );
    expect(checked.errors).toEqual([]);
    expect(checked.rows).toHaveLength(2);
    expect(
      mapRows(
        [
          ["Date", "Time"],
          ["2026-10-29T00:00:00.000Z", "1899-12-30T18:30:00.000Z"],
        ],
        { date: 0, time: 1 },
      ),
    ).toEqual([{ date: "2026-10-29", time: "18:30" }]);
  });
});
