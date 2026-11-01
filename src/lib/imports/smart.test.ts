import { describe, expect, it } from "vitest";
import { parseCsv } from "./parse";
import {
  buildRoster,
  buildSchedule,
  buildStats,
  detectKind,
  detectPlatform,
  findHeader,
  icsToGrid,
  matchFields,
  opponentFromTitle,
  parseDate,
  parsePosition,
  parseTime,
  teamNames,
} from "./smart";

const prep = (csv: string) => {
  const grid = parseCsv(csv);
  const { row, headers } = findHeader(grid);
  const kind = detectKind(headers);
  return { grid, row, headers, kind, map: matchFields(headers, kind) };
};

describe("switching: values", () => {
  it("reads dates however they're written", () => {
    expect(parseDate("2026-04-05")).toBe("2026-04-05");
    expect(parseDate("4/5/2026")).toBe("2026-04-05");
    expect(parseDate("4/5/26")).toBe("2026-04-05");
    expect(parseDate("Sat, Apr 5, 2026")).toBe("2026-04-05");
    expect(parseDate("April 5th 2026 6:00 PM")).toBe("2026-04-05");
    expect(parseDate("5-Apr-2026")).toBe("2026-04-05");
    expect(parseDate("46117")).toBe("2026-04-05");
    expect(parseDate("2026-04-05T18:00:00.000Z")).toBe("2026-04-05");
    expect(parseDate("2/30/2026")).toBeNull();
    expect(parseDate("TBD")).toBeNull();
  });
  it("reads times however they're written", () => {
    expect(parseTime("6:30 PM")).toBe("18:30");
    expect(parseTime("6:30pm")).toBe("18:30");
    expect(parseTime("6pm")).toBe("18:00");
    expect(parseTime("6:30 p.m.")).toBe("18:30");
    expect(parseTime("18:30:00")).toBe("18:30");
    expect(parseTime("4/5/2026 6:00 PM")).toBe("18:00");
    expect(parseTime("TBD")).toBe("");
    expect(parseTime("0.75")).toBe("18:00");
    expect(parseTime("1899-12-30T18:30:00.000Z")).toBe("18:30");
    expect(parseTime("6")).toBeNull();
    expect(parseTime("13:00 PM")).toBeNull();
  });
  it("normalizes positions", () => {
    expect(parsePosition("Shortstop")).toBe("SS");
    expect(parsePosition("RHP/OF")).toBe("P");
    expect(parsePosition("Center Field")).toBe("OF");
    expect(parsePosition("Utility")).toBe("UTIL");
    expect(parsePosition("Bench")).toBeNull();
  });
  it("finds opponents in event titles", () => {
    expect(opponentFromTitle("vs. Tigers")).toEqual({ opponent: "Tigers", home_away: "home" });
    expect(opponentFromTitle("@ Lions")).toEqual({ opponent: "Lions", home_away: "away" });
    expect(opponentFromTitle("Game vs Rays (DH)")).toEqual({ opponent: "Rays", home_away: "home" });
    expect(opponentFromTitle("Hawks vs Eagles", ["Eagles"])).toEqual({
      opponent: "Hawks",
      home_away: "away",
    });
    expect(opponentFromTitle("Practice")).toBeNull();
  });
});

describe("switching: TeamSnap roster", () => {
  const csv = [
    "Roster Export - 12U Thunder,,,,,,,",
    "First Name,Last Name,Jersey Number,Position,Birthday,Non-Player,p1email,p2email",
    "Alex,Rivera,#12,Shortstop,04/02/2014,,mom@ex.com,dad@ex.com",
    "Coach,Mike,,,,Y,coach@ex.com,",
    "Ben,Ortiz,7,LHP/1B,2014-08-30,No,ortiz.fam@ex.com,",
  ].join("\n");
  it("skips the title row and staff, maps parents and positions", () => {
    const p = prep(csv);
    expect(p.row).toBe(1);
    expect(p.kind).toBe("roster");
    expect(detectPlatform("roster.csv", p.headers)).toBe("teamsnap");
    const r = buildRoster(p.grid, p.row, p.map);
    expect(r.skipped).toHaveLength(1);
    expect(r.problems).toEqual([]);
    expect(r.records).toEqual([
      {
        name: "Alex Rivera",
        jersey: "12",
        position: "SS",
        birth_date: "2014-04-02",
        group: undefined,
        email: undefined,
        parents: ["mom@ex.com", "dad@ex.com"],
      },
      {
        name: "Ben Ortiz",
        jersey: "7",
        position: "P",
        birth_date: "2014-08-30",
        group: undefined,
        email: undefined,
        parents: ["ortiz.fam@ex.com"],
      },
    ]);
  });
});

describe("switching: LeagueApps registrations", () => {
  const csv = [
    "Program Name,Team Name,Registration Status,Participant First Name,Participant Last Name,Participant Birth Date,Parent 1 Email,Parent 2 Email,Participant Email",
    "Spring 2026,14U Gold,Registered,Cam,Lee,3/9/2012,lee.mom@ex.com,,cam.lee@ex.com",
    "Spring 2026,14U Gold,Cancelled,Dan,Fox,1/1/2012,fox@ex.com,,",
    "Spring 2026,14U Gold,Registered,Cam,Lee,3/9/2012,,lee.dad@ex.com,",
  ].join("\n");
  it("uses the team as a group, drops cancelled, merges duplicate rows' parents", () => {
    const p = prep(csv);
    expect(p.kind).toBe("roster");
    expect(detectPlatform("export.csv", p.headers)).toBe("leagueapps");
    expect(p.headers[p.map.group]).toBe("Team Name");
    const r = buildRoster(p.grid, p.row, p.map);
    expect(r.skipped.map((s) => s.message)).toEqual(["Registration cancelled."]);
    expect(r.records).toEqual([
      {
        name: "Cam Lee",
        jersey: undefined,
        position: undefined,
        birth_date: "2012-03-09",
        group: "14U Gold",
        email: "cam.lee@ex.com",
        parents: ["lee.mom@ex.com", "lee.dad@ex.com"],
      },
    ]);
  });
  it("a lone Email column on a youth roster belongs to the family", () => {
    const p = prep('Name,Email\n"Rivera, Alex",fam@ex.com');
    const r = buildRoster(p.grid, p.row, p.map);
    expect(r.records[0]).toMatchObject({
      name: "Alex Rivera",
      parents: ["fam@ex.com"],
      email: undefined,
    });
  });
});

describe("switching: schedules", () => {
  it("LeagueApps-style Home Team / Away Team keeps only our games", () => {
    const p = prep(
      [
        "Date,Start Time,Home Team,Away Team,Location,Event Type",
        "04/05/2026,6:00 PM,14U Gold,Rays,Field 2,Game",
        "04/06/2026,10:00 AM,Hawks,14U Gold,Hawks Park,Game",
        "04/07/2026,5:30 PM,Hawks,Rays,Field 9,Game",
        "04/08/2026,5:30 PM,,,Field 1,Practice",
      ].join("\n"),
    );
    expect(p.kind).toBe("schedule");
    expect(teamNames(p.grid, p.row, p.map)).toEqual(
      expect.arrayContaining(["14U Gold", "Hawks", "Rays"]),
    );
    const s = buildSchedule(p.grid, p.row, p.map, { ourTeams: ["14U Gold"] });
    expect(s.problems).toEqual([]);
    expect(s.skipped).toHaveLength(1);
    expect(s.records).toEqual([
      {
        kind: "game",
        opponent: "Rays",
        date: "2026-04-05",
        time: "18:00",
        home_away: "home",
        location: "Field 2",
        group: undefined,
      },
      {
        kind: "game",
        opponent: "Hawks",
        date: "2026-04-06",
        time: "10:00",
        home_away: "away",
        location: "Hawks Park",
        group: undefined,
      },
      {
        kind: "practice",
        title: "Practice",
        date: "2026-04-08",
        time: "17:30",
        location: "Field 1",
        group: undefined,
      },
    ]);
  });
  it("a calendar file becomes games and practices", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART;TZID=America/New_York:20260405T180000",
      "SUMMARY:vs. Tigers",
      "LOCATION:Memorial Field\\, Diamond 2",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:20260406",
      "SUMMARY:Team Practice",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "DTSTART:20260407T170000",
      "SUMMARY:@ Lions",
      "STATUS:CANCELLED",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "DTSTART:20260409T170000",
      "SUMMARY:Team photos",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const grid = icsToGrid(ics);
    const { row, headers } = findHeader(grid);
    const map = matchFields(headers, "schedule");
    const s = buildSchedule(grid, row, map);
    expect(s.records).toEqual([
      {
        kind: "game",
        opponent: "Tigers",
        date: "2026-04-05",
        time: "18:00",
        home_away: "home",
        location: "Memorial Field, Diamond 2",
        group: undefined,
      },
      {
        kind: "practice",
        title: "Team Practice",
        date: "2026-04-06",
        time: undefined,
        location: undefined,
        group: undefined,
      },
    ]);
    expect(s.skipped.map((x) => x.message)).toEqual(['"Team photos" isn\'t a game or practice.']);
  });
});

describe("switching: GameChanger season stats", () => {
  const csv = [
    ",,,Batting,,,,,Pitching,,,,",
    "Number,Last,First,GP,AB,H,HR,AVG,IP,H,ER,SO,ERA",
    "12,Rivera,Alex,20,60,21,3,.350,12.2,10,4,18,2.21",
    "7,Ortiz,Ben,18,50,12,0,.240,0.0,0,0,0,0.00",
    "Totals,,,20,110,33,3,.300,12.2,10,4,18,2.21",
  ].join("\n");
  it("splits batting and pitching lines and drops totals and empty pitching", () => {
    const p = prep(csv);
    expect(p.row).toBe(1);
    expect(p.kind).toBe("stats");
    expect(detectPlatform("stats.csv", p.headers)).toBe("gamechanger");
    const s = buildStats(p.grid, p.headers, p.row, p.map, { season: "2026 Spring" });
    expect(s.records.map((r) => r.values)).toEqual([
      {
        name: "Alex Rivera",
        season: "2026 Spring",
        category: "batting",
        jersey: "12",
        G: "20",
        AB: "60",
        H: "21",
        HR: "3",
        AVG: ".350",
      },
      {
        name: "Alex Rivera",
        season: "2026 Spring",
        category: "pitching",
        jersey: "12",
        IP: "12.2",
        H: "10",
        ER: "4",
        SO: "18",
        ERA: "2.21",
      },
      {
        name: "Ben Ortiz",
        season: "2026 Spring",
        category: "batting",
        jersey: "7",
        G: "18",
        AB: "50",
        H: "12",
        HR: "0",
        AVG: ".240",
      },
    ]);
  });
});
