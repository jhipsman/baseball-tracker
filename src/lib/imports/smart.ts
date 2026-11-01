/**
 * Switching to 9D: turn whatever a team exports (GameChanger, TeamSnap,
 * LeagueApps, SportsEngine, a spreadsheet or a calendar file) into roster
 * players, games/practices or stat lines. Pure and forgiving: platforms don't
 * publish fixed export formats, so headers are matched loosely, header rows
 * are found under titles, and dates/times/positions come in many shapes.
 */
import type { ImportKind } from "./parse";

export type Platform =
  "gamechanger" | "teamsnap" | "leagueapps" | "sportsengine" | "sheets" | "other";

export const STAT_KEYS = [
  "G",
  "PA",
  "AB",
  "R",
  "H",
  "1B",
  "2B",
  "3B",
  "HR",
  "RBI",
  "BB",
  "HBP",
  "SO",
  "SB",
  "CS",
  "AVG",
  "OBP",
  "SLG",
  "OPS",
  "IP",
  "ER",
  "ERA",
  "WHIP",
] as const;
const RATE = new Set(["AVG", "OBP", "SLG", "OPS", "ERA", "WHIP"]);
/** Stats that only make sense in a pitching line, and those only in a batting line. */
const PITCHING_ONLY = new Set(["IP", "ER", "ERA", "WHIP"]);
const BATTING_ONLY = new Set([
  "PA",
  "AB",
  "1B",
  "2B",
  "3B",
  "RBI",
  "SB",
  "CS",
  "AVG",
  "OBP",
  "SLG",
  "OPS",
]);

export type Field = {
  key: string;
  label: string;
  kinds: ImportKind[];
  /** Normalized header names that mean this field. */
  aliases: string[];
  /** Looser matches tried after exact aliases. */
  patterns?: RegExp[];
  required?: boolean;
};

const PARENT = String.raw`(?:parent|guardian|p|mother|father|mom|dad|contact|family|primary contact|secondary contact)`;
export const FIELDS: Field[] = [
  // Shared player identity
  {
    key: "name",
    label: "Player name",
    kinds: ["roster", "stats"],
    aliases: [
      "name",
      "player",
      "player name",
      "full name",
      "athlete",
      "athlete name",
      "participant",
      "participant name",
      "member name",
      "player full name",
      "child name",
      "child",
    ],
  },
  {
    key: "first_name",
    label: "First name",
    kinds: ["roster", "stats"],
    aliases: [
      "first",
      "first name",
      "firstname",
      "player first name",
      "participant first name",
      "athlete first name",
      "child first name",
      "fname",
    ],
  },
  {
    key: "last_name",
    label: "Last name",
    kinds: ["roster", "stats"],
    aliases: [
      "last",
      "last name",
      "lastname",
      "player last name",
      "participant last name",
      "athlete last name",
      "child last name",
      "lname",
      "surname",
    ],
  },
  {
    key: "jersey",
    label: "Jersey number",
    kinds: ["roster", "stats"],
    aliases: [
      "jersey",
      "jersey number",
      "jersey #",
      "jersey no",
      "number",
      "#",
      "no",
      "num",
      "uniform",
      "uniform number",
      "uniform #",
      "player number",
    ],
  },
  // Roster
  {
    key: "position",
    label: "Position",
    kinds: ["roster"],
    aliases: ["position", "positions", "pos", "primary position", "position s", "player position"],
  },
  {
    key: "birth_date",
    label: "Birthday",
    kinds: ["roster"],
    aliases: [
      "birthday",
      "birth date",
      "birthdate",
      "date of birth",
      "dob",
      "player birthdate",
      "player birth date",
      "participant birth date",
      "participant birthdate",
      "athlete birth date",
    ],
  },
  {
    key: "group",
    label: "Team / division (becomes a group)",
    kinds: ["roster", "schedule"],
    aliases: [
      "team",
      "team name",
      "division",
      "division name",
      "program",
      "program name",
      "group",
      "group name",
      "age group",
      "squad",
      "level",
      "roster",
      "assigned team",
    ],
  },
  {
    key: "email",
    label: "Player's own email",
    kinds: ["roster"],
    aliases: [
      "player email",
      "participant email",
      "athlete email",
      "player email address",
      "email",
      "email address",
      "email address 1",
      "e mail",
      "user email",
    ],
  },
  {
    key: "parent1_email",
    label: "Parent email",
    kinds: ["roster"],
    aliases: [
      "parent email",
      "guardian email",
      "parent guardian email",
      "parent 1 email",
      "parent1 email",
      "p1email",
      "p1 email",
      "guardian 1 email",
      "primary parent email",
      "mother email",
      "mom email",
      "family email",
      "account email",
      "primary contact email",
      "contact email",
      "registrant email",
    ],
    patterns: [
      new RegExp(String.raw`^${PARENT}\s*(?:1|one)?\s*(?:e ?mail|email address)(?:\s*1)?$`),
    ],
  },
  {
    key: "parent2_email",
    label: "Second parent email",
    kinds: ["roster"],
    aliases: [
      "parent 2 email",
      "parent2 email",
      "p2email",
      "p2 email",
      "guardian 2 email",
      "secondary parent email",
      "father email",
      "dad email",
      "email address 2",
      "secondary contact email",
      "secondary email",
    ],
    patterns: [new RegExp(String.raw`^${PARENT}\s*(?:2|two)\s*(?:e ?mail|email address)$`)],
  },
  {
    key: "non_player",
    label: "Non-player / staff flag",
    kinds: ["roster"],
    aliases: [
      "non player",
      "nonplayer",
      "is non player",
      "staff",
      "role",
      "member type",
      "player type",
    ],
  },
  {
    key: "status",
    label: "Registration status",
    kinds: ["roster"],
    aliases: ["status", "registration status", "roster status", "player status"],
  },
  // Schedule
  {
    key: "date",
    label: "Date",
    kinds: ["schedule"],
    aliases: [
      "date",
      "game date",
      "event date",
      "start date",
      "start",
      "day",
      "date time",
      "start date time",
      "start time date",
    ],
    required: true,
  },
  {
    key: "time",
    label: "Start time",
    kinds: ["schedule"],
    aliases: ["time", "start time", "game time", "event time", "kickoff time", "first pitch"],
  },
  {
    key: "opponent",
    label: "Opponent",
    kinds: ["schedule"],
    aliases: [
      "opponent",
      "opponent name",
      "opposing team",
      "vs",
      "versus",
      "against",
      "opponent team",
    ],
  },
  {
    key: "home_team",
    label: "Home team",
    kinds: ["schedule"],
    aliases: ["home team", "home", "home team name"],
  },
  {
    key: "away_team",
    label: "Away team",
    kinds: ["schedule"],
    aliases: ["away team", "away", "visitor", "visiting team", "visitors", "away team name"],
  },
  {
    key: "home_away",
    label: "Home / away",
    kinds: ["schedule"],
    aliases: [
      "home away",
      "home/away",
      "h a",
      "ha",
      "home or away",
      "home away neutral",
      "venue type",
    ],
  },
  {
    key: "location",
    label: "Field / location",
    kinds: ["schedule"],
    aliases: [
      "location",
      "field",
      "venue",
      "venue name",
      "location name",
      "facility",
      "park",
      "address",
      "field name",
      "where",
    ],
  },
  {
    key: "event_type",
    label: "Game or practice",
    kinds: ["schedule"],
    aliases: [
      "event type",
      "type",
      "event",
      "category",
      "kind",
      "game type",
      "activity",
      "game practice",
    ],
  },
  {
    key: "title",
    label: "Event name",
    kinds: ["schedule"],
    aliases: [
      "title",
      "name",
      "event name",
      "summary",
      "description",
      "short description",
      "label",
      "subject",
      "event title",
    ],
  },
  // Stats
  { key: "season", label: "Season", kinds: ["stats"], aliases: ["season", "year"] },
  {
    key: "category",
    label: "Stat type",
    kinds: ["stats"],
    aliases: ["category", "stat type", "type"],
  },
  ...STAT_KEYS.map((k) => ({
    key: k,
    label: k,
    kinds: ["stats" as ImportKind],
    aliases: [
      k.toLowerCase(),
      ...(k === "SO"
        ? ["k", "strikeouts", "so k"]
        : k === "G"
          ? ["gp", "games"]
          : k === "HBP"
            ? ["hp"]
            : k === "BB"
              ? ["walks"]
              : []),
    ],
  })),
];
export const fieldsFor = (kind: ImportKind) => FIELDS.filter((f) => f.kinds.includes(kind));

/** "Parent 1 E-mail" → "parent 1 e mail"; keeps # for jersey columns. */
export const normHeader = (h: string) =>
  h
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9#]+/g, " ")
    .trim();

// ------------------------------------------------------------------ headers

const SECTION = /^(batting|hitting|offense|pitching|fielding|defense|catching|baserunning)$/;

/**
 * The header row (some exports put a title or blank rows first) and, for
 * GameChanger-style stats, a section row above it ("Batting", "Pitching").
 * Returns headers like "batting:H" / "pitching:H" for sectioned columns.
 */
export function findHeader(grid: string[][]): { row: number; headers: string[] } {
  let best = 0;
  let bestScore = -1;
  const known = new Set(FIELDS.flatMap((f) => f.aliases));
  for (let r = 0; r < Math.min(grid.length - 1, 15); r++) {
    const score = grid[r].filter((c) => known.has(normHeader(c))).length;
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }
  const headers = grid[best].map((c) => c.trim());
  const above = best > 0 ? grid[best - 1] : null;
  if (above && above.some((c) => SECTION.test(normHeader(c)))) {
    let section = "";
    return {
      row: best,
      headers: headers.map((h, i) => {
        const s = normHeader(above[i] ?? "");
        if (SECTION.test(s)) section = s === "hitting" || s === "offense" ? "batting" : s;
        else if (s) section = "";
        return section && isStatHeader(h) ? `${section}:${h}` : h;
      }),
    };
  }
  return { row: best, headers };
}

const STAT_ALIASES = new Map(
  FIELDS.filter((f) => (STAT_KEYS as readonly string[]).includes(f.key)).flatMap((f) =>
    f.aliases.map((a) => [a, f.key] as const),
  ),
);
const isStatHeader = (h: string) => STAT_ALIASES.has(normHeader(h));

/** Column index per field key (−1 when absent). Exact aliases first, then patterns. */
export function matchFields(headers: string[], kind: ImportKind): Record<string, number> {
  const used = new Set<number>();
  const out: Record<string, number> = {};
  const fields = fieldsFor(kind);
  const plain = headers.map((h) => normHeader(h.replace(/^[a-z]+:/i, "")));
  // Pass 1: exact aliases, in alias order (first alias wins ties).
  for (const f of fields) {
    out[f.key] = -1;
    if (kind === "stats" && (STAT_KEYS as readonly string[]).includes(f.key)) continue;
    for (const a of f.aliases) {
      const i = plain.findIndex((h, j) => h === a && !used.has(j));
      if (i >= 0) {
        out[f.key] = i;
        used.add(i);
        break;
      }
    }
  }
  // Pass 2: patterns.
  for (const f of fields) {
    if (out[f.key] >= 0 || !f.patterns) continue;
    const i = plain.findIndex((h, j) => !used.has(j) && f.patterns!.some((p) => p.test(h)));
    if (i >= 0) {
      out[f.key] = i;
      used.add(i);
    }
  }
  // A lone "email" with a parent column next to it is the player's; without
  // one, youth exports' only email is the family's.
  if (
    kind === "roster" &&
    out.email >= 0 &&
    out.parent1_email < 0 &&
    !/player|participant|athlete/.test(plain[out.email])
  ) {
    out.parent1_email = out.email;
    out.email = -1;
  }
  // "Name" can be the event title in schedules and the team in rosters with a separate player column.
  if (
    kind === "roster" &&
    out.name >= 0 &&
    out.first_name >= 0 &&
    out.last_name >= 0 &&
    plain[out.name] === "name"
  )
    out.name = -1;
  return out;
}

/** Stat columns: plain ("H") or sectioned ("batting:H"). */
export function statColumns(headers: string[]) {
  const cols: { index: number; stat: string; section: "batting" | "pitching" | null }[] = [];
  headers.forEach((h, index) => {
    const m = h.match(/^([a-z]+):(.*)$/i);
    const section = m ? m[1].toLowerCase() : null;
    const stat = STAT_ALIASES.get(normHeader(m ? m[2] : h));
    if (!stat || (section && section !== "batting" && section !== "pitching")) return;
    cols.push({ index, stat, section: section as "batting" | "pitching" | null });
  });
  return cols;
}

/** Best guess at what a file holds. */
export function detectKind(headers: string[]): ImportKind {
  const plain = headers.map(normHeader);
  if (headers.some((h) => /^(batting|pitching):/.test(h)) || statColumns(headers).length >= 4)
    return "stats";
  const schedule = [
    "date",
    "game date",
    "opponent",
    "home team",
    "away team",
    "start time",
    "location",
    "event type",
  ].filter((a) => plain.includes(a)).length;
  const roster = [
    "first name",
    "last name",
    "jersey",
    "jersey number",
    "position",
    "birthdate",
    "birth date",
    "date of birth",
    "player name",
  ].filter((a) => plain.includes(a)).length;
  return schedule > roster ? "schedule" : "roster";
}

/** Guess the platform from file name and headers (only used to pick defaults and copy). */
export function detectPlatform(fileName: string, headers: string[]): Platform | null {
  const n = fileName.toLowerCase();
  const plain = headers.map(normHeader);
  if (/gamechanger|\bgc\b/.test(n) || headers.some((h) => /^(batting|pitching):/.test(h)))
    return "gamechanger";
  if (
    /teamsnap/.test(n) ||
    plain.some((h) => /^p[12]email$/.test(h)) ||
    plain.includes("non player")
  )
    return "teamsnap";
  if (/leagueapps/.test(n) || plain.some((h) => /^program( name)?$/.test(h))) return "leagueapps";
  if (/sportsengine|sports engine|\bse\b/.test(n)) return "sportsengine";
  return null;
}

// ------------------------------------------------------------------ values

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n: number) => String(n).padStart(2, "0");
function ymd(y: number, m: number, d: number): string | null {
  if (y < 100) y += y >= 70 ? 1900 : 2000;
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
    ? `${y}-${pad(m)}-${pad(d)}`
    : null;
}

/** Most ways a date gets written (US order for slashes), and Excel serial numbers. */
export function parseDate(input: string): string | null {
  const s = input.trim().replace(/\s+/g, " ");
  if (!s) return null;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/))) return ymd(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:\s.*)?$/)))
    return ymd(+m[3], +m[1], +m[2]);
  if ((m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/))) return ymd(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) return ymd(+m[1], +m[2], +m[3]);
  // "Sat, Apr 5, 2026", "April 5 2026 6:00 PM", "5-Apr-2026", "5 April 2026"
  const words = s
    .toLowerCase()
    .replace(/,/g, " ")
    .replace(/\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?(\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (
    (m = words.match(/^([a-z]{3})[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\s+(\d{4})/)) &&
    MONTHS.includes(m[1])
  )
    return ymd(+m[3], MONTHS.indexOf(m[1]) + 1, +m[2]);
  if (
    (m = words.match(/^(\d{1,2})[\s-]([a-z]{3})[a-z]*\.?[\s-](\d{2,4})/)) &&
    MONTHS.includes(m[2])
  )
    return ymd(+m[3], MONTHS.indexOf(m[2]) + 1, +m[1]);
  // Excel serial day number (1900 system).
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const n = Math.floor(Number(s));
    if (n > 20000 && n < 80000) {
      const d = new Date(Date.UTC(1899, 11, 30) + n * 86_400_000);
      return d.toISOString().slice(0, 10);
    }
  }
  return null;
}

/** "6:30 PM", "6:30PM", "6pm", "18:30", "18:30:00", "6:30 p.m."; TBD/blank → "". null if unreadable. */
export function parseTime(input: string): string | null {
  // Excel date/time cells arrive as ISO timestamps holding the wall-clock time in UTC.
  const iso = input.trim().match(/^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})/);
  if (iso) return `${iso[1]}:${iso[2]}`;
  // Excel time fraction (0.75 = 6 PM).
  if (/^0?\.\d+$/.test(input.trim())) {
    const mins = Math.round(Number(input.trim()) * 1440);
    return `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`;
  }
  const s = input.trim().toLowerCase().replace(/\./g, "").replace(/\s+/g, " ");
  if (!s || /^(tbd|tba|n\/?a|-+)$/.test(s)) return "";
  // A date-time cell ("2026-04-05 18:00", "4/5/2026 6:00 PM", ISO from Excel).
  const tail = s.match(/(?:^|[ t])(\d{1,2}(?::\d{2})?(?::\d{2})?\s?(?:am|pm|a|p)?)$/);
  const t = (tail ? tail[1] : s).trim();
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s?(am|pm|a|p)?$/);
  if (!m) {
    return null;
  }
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const ap = m[3]?.[0];
  if (min > 59 || h > (ap ? 12 : 23) || (ap && h < 1)) return null;
  if (!ap && m[2] === undefined) return null; // a bare number isn't a time
  if (ap) h = (h % 12) + (ap === "p" ? 12 : 0);
  return `${pad(h)}:${pad(min)}`;
}

const POSITION_WORDS: [RegExp, string][] = [
  [/^(p|rhp|lhp|sp|rp|pitcher|pitching)$/, "P"],
  [/^(c|catcher|catching)$/, "C"],
  [/^(1b|first|first base|1st|1st base)$/, "1B"],
  [/^(2b|second|second base|2nd|2nd base)$/, "2B"],
  [/^(ss|short|shortstop|short stop)$/, "SS"],
  [/^(3b|third|third base|3rd|3rd base)$/, "3B"],
  [/^(of|lf|cf|rf|outfield|outfielder|left field|center field|centre field|right field)$/, "OF"],
  [/^(dh|designated hitter)$/, "DH"],
  [/^(util|ut|utility|if|inf|infield|infielder|mif)$/, "UTIL"],
];
/** First recognizable position in "SS/P", "Pitcher, Outfield", "RHP"… */
export function parsePosition(input: string): string | null {
  for (const part of input.toLowerCase().split(/[/,;|&+]| and /)) {
    const p = part.trim().replace(/\.$/, "");
    for (const [re, pos] of POSITION_WORDS) if (re.test(p)) return pos;
  }
  return null;
}

/** "Rivera, Alex" → "Alex Rivera"; collapses spaces. */
export function parseName(input: string): string {
  const s = input.trim().replace(/\s+/g, " ");
  const m = s.match(/^([^,]+),\s*([^,]+)$/);
  return m && !/\b(jr|sr|ii|iii|iv)\.?$/i.test(m[2]) ? `${m[2]} ${m[1]}` : s;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/** Emails from a cell that may hold several ("a@x.com; b@y.com"). */
export const emailsIn = (input: string) =>
  input
    .split(/[\s,;]+/)
    .map((e) =>
      e
        .trim()
        .toLowerCase()
        .replace(/^mailto:/, ""),
    )
    .filter((e) => EMAIL.test(e));

// ------------------------------------------------------------------ schedule

const PRACTICE =
  /\b(practice|training|workout|cages?|bp|batting practice|team meeting|conditioning|lift|clinic|bullpen session|tryouts?)\b/i;
const GAME = /\b(game|vs\.?|versus|scrimmage|tournament|tourney|doubleheader|dh|playoffs?|@|at)\b/i;

/** Opponent and home/away from an event title like "vs. Tigers", "@ Lions", "Hawks at Eagles". */
export function opponentFromTitle(
  title: string,
  ours: string[] = [],
): { opponent: string; home_away: "home" | "away" | "neutral" } | null {
  const t = title.replace(/\s+/g, " ").trim();
  const clean = (s: string) =>
    s
      .replace(/^(game|scrimmage|tournament)\s*[:-]?\s*/i, "")
      .replace(/\s*\(.*\)$/, "")
      .trim();
  const isOurs = (s: string) => ours.some((o) => o && normHeader(s) === normHeader(o));
  let m = t.match(/^(.*?)(?:^|\s)(?:vs\.?|versus|v\.)\s+(.+)$/i);
  if (m) {
    const [a, b] = [clean(m[1]), clean(m[2])];
    if (!a || /^(game|scrimmage|home)$/i.test(a)) return { opponent: b, home_away: "home" };
    if (isOurs(b)) return { opponent: a, home_away: "away" };
    return { opponent: b, home_away: "home" };
  }
  m = t.match(/^(.*?)\s*(?:@|\bat\b)\s+(.+)$/i);
  if (m) {
    const [a, b] = [clean(m[1]), clean(m[2])];
    if (!a || /^(game|scrimmage|away)$/i.test(a)) return { opponent: b, home_away: "away" };
    if (isOurs(b)) return { opponent: a, home_away: "home" };
    return { opponent: b, home_away: "away" };
  }
  return null;
}

export type ScheduleEvent = {
  kind: "game" | "practice";
  opponent?: string;
  title?: string;
  date: string;
  time?: string;
  home_away?: "home" | "away" | "neutral";
  location?: string;
  group?: string;
};
export type RosterPerson = {
  name: string;
  jersey?: string;
  position?: string;
  birth_date?: string;
  group?: string;
  email?: string;
  parents: string[];
};
export type StatLine = { key: string; values: Record<string, string> };
export type Problem = { row: number; message: string };
export type Built<T> = { records: T[]; problems: Problem[]; skipped: Problem[] };

/** Team names seen in Home team / Away team columns, most frequent first (to ask "which is you?"). */
export function teamNames(
  grid: string[][],
  headerRow: number,
  map: Record<string, number>,
): string[] {
  const count = new Map<string, number>();
  for (const row of grid.slice(headerRow + 1))
    for (const k of ["home_team", "away_team"]) {
      const v = map[k] >= 0 ? (row[map[k]] ?? "").trim() : "";
      if (v) count.set(v, (count.get(v) ?? 0) + 1);
    }
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
}

const cell = (row: string[], map: Record<string, number>, key: string) =>
  map[key] >= 0 ? String(row[map[key]] ?? "").trim() : "";

export function buildSchedule(
  grid: string[][],
  headerRow: number,
  map: Record<string, number>,
  opts: { ourTeams?: string[] } = {},
): Built<ScheduleEvent> {
  const out: Built<ScheduleEvent> = { records: [], problems: [], skipped: [] };
  const ours = (opts.ourTeams ?? []).filter(Boolean);
  const seen = new Set<string>();
  grid.slice(headerRow + 1).forEach((row, i) => {
    const n = headerRow + i + 2;
    if (!row.some((c) => String(c).trim())) return;
    const rawDate = cell(row, map, "date");
    const date = parseDate(rawDate);
    const time = parseTime(cell(row, map, "time") || (/\d:\d|[ap]m/i.test(rawDate) ? rawDate : ""));
    if (!date)
      return void out.problems.push({
        row: n,
        message: rawDate ? `"${rawDate}" isn't a date we can read.` : "No date.",
      });
    if (time === null)
      return void out.problems.push({
        row: n,
        message: `"${cell(row, map, "time")}" isn't a time we can read.`,
      });
    const type = cell(row, map, "event_type").toLowerCase();
    const title = cell(row, map, "title");
    const location = cell(row, map, "location");
    const group = cell(row, map, "group");
    let opponent = cell(row, map, "opponent");
    let home_away: ScheduleEvent["home_away"];
    const ha = normHeader(cell(row, map, "home_away"));
    if (ha)
      home_away = /^(a|away|road|visitor|visiting|@)$/.test(ha)
        ? "away"
        : /^(n|neutral)$/.test(ha)
          ? "neutral"
          : "home";
    const home = cell(row, map, "home_team");
    const away = cell(row, map, "away_team");
    if (!opponent && (home || away)) {
      const isOurs = (s: string) => ours.some((o) => normHeader(o) === normHeader(s));
      if (ours.length && isOurs(home)) {
        opponent = away;
        home_away ??= "home";
      } else if (ours.length && isOurs(away)) {
        opponent = home;
        home_away ??= "away";
      } else if (ours.length) {
        return void out.skipped.push({
          row: n,
          message: `Not your team's game (${home || "?"} vs ${away || "?"}).`,
        });
      }
    }
    const practice =
      /practice|training|workout|clinic|meeting/.test(type) ||
      (!opponent && !home && !away && PRACTICE.test(title) && !/vs|@/i.test(title));
    if (practice) {
      const key = `p|${date}|${time}`;
      if (seen.has(key)) return void out.skipped.push({ row: n, message: "Listed twice." });
      seen.add(key);
      out.records.push({
        kind: "practice",
        title: title || "Practice",
        date,
        time: time || undefined,
        location: location || undefined,
        group: group || undefined,
      });
      return;
    }
    if (!opponent && title) {
      const fromTitle = opponentFromTitle(title, ours);
      if (fromTitle) {
        opponent = fromTitle.opponent;
        home_away ??= fromTitle.home_away;
      } else if (/game|scrimmage|tournament/.test(type) || GAME.test(title))
        opponent = title.replace(/^(game|scrimmage)\s*[:-]\s*/i, "");
    }
    if (!opponent) {
      if (/event|other|meeting|party|photo|fundrais/.test(type) || title)
        return void out.skipped.push({
          row: n,
          message: `"${title || type}" isn't a game or practice.`,
        });
      return void out.problems.push({ row: n, message: "No opponent." });
    }
    const key = `g|${date}|${normHeader(opponent)}`;
    if (seen.has(key)) return void out.skipped.push({ row: n, message: "Listed twice." });
    seen.add(key);
    out.records.push({
      kind: "game",
      opponent: opponent.slice(0, 120),
      date,
      time: time || undefined,
      home_away: home_away ?? "home",
      location: location || undefined,
      group: group || undefined,
    });
  });
  return out;
}

export function buildRoster(
  grid: string[][],
  headerRow: number,
  map: Record<string, number>,
  opts: { emailsAreParents?: boolean } = {},
): Built<RosterPerson> {
  const out: Built<RosterPerson> = { records: [], problems: [], skipped: [] };
  const byName = new Map<string, RosterPerson>();
  grid.slice(headerRow + 1).forEach((row, i) => {
    const n = headerRow + i + 2;
    if (!row.some((c) => String(c).trim())) return;
    const nonPlayer = normHeader(cell(row, map, "non_player"));
    if (/^(y|yes|true|1|x|staff|coach|manager|non player|parent|guardian|admin)$/.test(nonPlayer))
      return void out.skipped.push({ row: n, message: "Not a player (staff or non-player)." });
    const status = normHeader(cell(row, map, "status"));
    if (/cancel|withdr|declin|refund|inactive|waitlist|wait list|removed|deleted/.test(status))
      return void out.skipped.push({
        row: n,
        message: `Registration ${cell(row, map, "status").toLowerCase()}.`,
      });
    const first = cell(row, map, "first_name");
    const last = cell(row, map, "last_name");
    const name = parseName(cell(row, map, "name") || [first, last].filter(Boolean).join(" "));
    if (!name) return void out.problems.push({ row: n, message: "No player name." });
    if (/^(team )?totals?$|^team$/i.test(name))
      return void out.skipped.push({ row: n, message: "Totals row." });
    const jerseyRaw = cell(row, map, "jersey").replace(/^#/, "");
    const jersey = /^\d{1,2}$/.test(jerseyRaw) ? String(Number(jerseyRaw)) : undefined;
    if (jerseyRaw && !jersey)
      out.problems.push({ row: n, message: `Jersey "${jerseyRaw}" ignored (use 0–99).` });
    const birthRaw = cell(row, map, "birth_date");
    const birth_date = birthRaw ? (parseDate(birthRaw) ?? undefined) : undefined;
    if (birthRaw && !birth_date)
      out.problems.push({ row: n, message: `Birthday "${birthRaw}" ignored.` });
    const own = emailsIn(cell(row, map, "email"));
    const parents = [
      ...emailsIn(cell(row, map, "parent1_email")),
      ...emailsIn(cell(row, map, "parent2_email")),
    ];
    const person: RosterPerson = {
      name: name.slice(0, 80),
      jersey,
      position: parsePosition(cell(row, map, "position")) ?? undefined,
      birth_date,
      group: cell(row, map, "group").slice(0, 60) || undefined,
      email: opts.emailsAreParents ? undefined : own[0],
      parents: [...new Set([...parents, ...(opts.emailsAreParents ? own : [])])]
        .filter((e) => e !== own[0] || opts.emailsAreParents)
        .slice(0, 4),
    };
    // LeagueApps/TeamSnap exports can list a player once per parent: merge.
    const key = `${normHeader(person.name)}|${person.jersey ?? ""}`;
    const prev = byName.get(key);
    if (prev) {
      prev.parents = [...new Set([...prev.parents, ...person.parents])].slice(0, 4);
      prev.email ??= person.email;
      prev.position ??= person.position;
      prev.birth_date ??= person.birth_date;
      prev.group ??= person.group;
      return;
    }
    byName.set(key, person);
    out.records.push(person);
  });
  return out;
}

/**
 * Stat lines. Sectioned exports (GameChanger: a Batting/Pitching row above the
 * stat names) give each player a batting line and a pitching line.
 */
export function buildStats(
  grid: string[][],
  headers: string[],
  headerRow: number,
  map: Record<string, number>,
  opts: { season: string; category?: "batting" | "pitching" },
): Built<StatLine> {
  const out: Built<StatLine> = { records: [], problems: [], skipped: [] };
  const cols = statColumns(headers);
  const sections = new Set(cols.map((c) => c.section).filter(Boolean));
  const seen = new Set<string>();
  grid.slice(headerRow + 1).forEach((row, i) => {
    const n = headerRow + i + 2;
    if (!row.some((c) => String(c).trim())) return;
    const name = parseName(
      cell(row, map, "name") ||
        [cell(row, map, "first_name"), cell(row, map, "last_name")].filter(Boolean).join(" "),
    );
    if (
      !name ||
      /^(team )?totals?$|^team$|^glossary/i.test(name) ||
      /^totals?$/i.test(String(row[0] ?? "").trim())
    )
      return void (name && out.skipped.push({ row: n, message: "Totals row." }));
    const jersey = cell(row, map, "jersey").replace(/^#/, "");
    const season = cell(row, map, "season") || opts.season;
    const lines: ("batting" | "pitching")[] = sections.size
      ? (["batting", "pitching"] as const).filter((s) => sections.has(s))
      : [
          (normHeader(cell(row, map, "category")) as "batting" | "pitching") ||
            opts.category ||
            "batting",
        ];
    for (const category of lines) {
      const values: Record<string, string> = { name: name.slice(0, 80), season, category };
      if (/^\d{1,2}$/.test(jersey)) values.jersey = String(Number(jersey));
      let count = 0;
      for (const c of cols) {
        if (
          sections.size
            ? c.section !== category
            : (category === "pitching" ? BATTING_ONLY : PITCHING_ONLY).has(c.stat)
        )
          continue;
        let v = String(row[c.index] ?? "").trim();
        if (!v || v === "-" || v === "—" || /^n\/?a$/i.test(v)) continue;
        if (RATE.has(c.stat) && /^0?\.\d+$|^\d+\.\d+$|^\d+$/.test(v)) v = v.replace(/^0(?=\.)/, "");
        if (c.stat === "IP" && !/^\d+(?:\.[012])?$/.test(v)) {
          out.problems.push({
            row: n,
            message: `IP "${v}" should look like 12.2 (12 innings, 2 outs).`,
          });
          continue;
        }
        if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(v)) continue;
        if (!RATE.has(c.stat) && c.stat !== "IP" && !/^\d+$/.test(v)) continue;
        values[c.stat] = v;
        count++;
      }
      // A pitching line of zeros (never pitched) isn't worth keeping.
      const real = Object.entries(values).some(
        ([k, v]) => (STAT_KEYS as readonly string[]).includes(k) && Number(v) > 0,
      );
      if (!count || (sections.size && !real)) continue;
      const key = `${normHeader(name)}|${values.jersey ?? ""}|${normHeader(season)}|${category}`;
      if (seen.has(key)) {
        out.skipped.push({ row: n, message: "Listed twice." });
        continue;
      }
      seen.add(key);
      out.records.push({ key, values });
    }
  });
  return out;
}

// ------------------------------------------------------------------ calendar files

/** Unfold and read an .ics calendar (TeamSnap, GameChanger, SportsEngine, Google…) into a schedule grid. */
export function icsToGrid(text: string): string[][] {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n");
  const grid: string[][] = [["Date", "Time", "Title", "Location", "Event type"]];
  let ev: Record<string, string> | null = null;
  const unescape = (s: string) =>
    s
      .replace(/\\n/gi, " ")
      .replace(/\\([,;\\])/g, "$1")
      .trim();
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") ev = {};
    else if (line === "END:VEVENT" && ev) {
      const start = ev.DTSTART ?? "";
      const [params, value] = [ev.DTSTART_PARAMS ?? "", start];
      let date = "";
      let time = "";
      const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})\d{2}(Z)?)?$/);
      if (m) {
        if (m[4] && m[6]) {
          // UTC: show in the browser's local time (the coach's).
          const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
          date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
          time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
        } else {
          date = `${m[1]}-${m[2]}-${m[3]}`;
          time = m[4] && !/VALUE=DATE(?!-)/.test(params) ? `${m[4]}:${m[5]}` : "";
        }
      }
      if (date && ev.STATUS !== "CANCELLED")
        grid.push([
          date,
          time,
          unescape(ev.SUMMARY ?? ""),
          unescape(ev.LOCATION ?? ""),
          unescape(ev.CATEGORIES ?? ""),
        ]);
      ev = null;
    } else if (ev) {
      const i = line.indexOf(":");
      if (i < 0) continue;
      const [name, ...params] = line.slice(0, i).split(";");
      ev[name.toUpperCase()] = line.slice(i + 1);
      if (name.toUpperCase() === "DTSTART") ev.DTSTART_PARAMS = params.join(";");
    }
  }
  if (grid.length > 1001) throw new Error("Import up to 1,000 events at a time.");
  return grid;
}
