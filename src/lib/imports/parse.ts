export type ImportKind = "roster" | "schedule" | "stats";
export type ImportSource = "sheets" | "excel" | "gamechanger" | "leagueapps" | "other";
export type ImportRow = { key: string; values: Record<string, string> };
export type Column = { key: string; label: string; aliases: string[]; required?: boolean };
export const COLUMNS: Record<ImportKind, Column[]> = {
  roster: [
    {
      key: "name",
      label: "Player name",
      aliases: ["name", "player", "player name", "full name", "athlete"],
      required: true,
    },
    { key: "first_name", label: "First name (if separate)", aliases: ["first", "first name"] },
    { key: "last_name", label: "Last name (if separate)", aliases: ["last", "last name"] },
    {
      key: "external_id",
      label: "Player ID from source",
      aliases: ["player id", "id", "athlete id"],
    },
    {
      key: "jersey",
      label: "Jersey number",
      aliases: ["jersey", "jersey number", "number", "#", "no"],
    },
    { key: "position", label: "Position", aliases: ["position", "pos", "positions"] },
    {
      key: "email",
      label: "Player email (optional)",
      aliases: ["email", "email address", "player email"],
    },
  ],
  schedule: [
    {
      key: "group",
      label: "Team / roster group (optional)",
      aliases: ["group", "group name", "team", "team name"],
    },
    {
      key: "opponent",
      label: "Opponent",
      aliases: ["opponent", "opposing team", "opponent name"],
      required: true,
    },
    {
      key: "date",
      label: "Game date",
      aliases: ["date", "game date", "start date"],
      required: true,
    },
    { key: "time", label: "Start time", aliases: ["time", "start time", "game time"] },
    { key: "home_away", label: "Home / away", aliases: ["home away", "home/away", "venue", "ha"] },
    { key: "location", label: "Field / location", aliases: ["location", "field", "venue name"] },
  ],
  stats: [
    {
      key: "name",
      label: "Player name",
      aliases: ["name", "player", "player name", "full name"],
      required: true,
    },
    {
      key: "external_id",
      label: "Player ID from source",
      aliases: ["player id", "id", "athlete id"],
    },
    { key: "category", label: "Stat type", aliases: ["category", "stat type"] },
    { key: "season", label: "Season", aliases: ["season", "year"] },
    ...[
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
    ].map((key) => ({
      key,
      label: key,
      aliases: [key.toLowerCase(), ...(key === "SO" ? ["k", "strikeouts"] : [])],
    })),
  ],
};
const norm = (v: string) =>
  v
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, " ");
export function guessMapping(headers: string[], kind: ImportKind): Record<string, number> {
  return Object.fromEntries(
    COLUMNS[kind].map((c) => [c.key, headers.findIndex((h) => c.aliases.includes(norm(h)))]),
  );
}
/** RFC-style quoted cells, escaped quotes, CRLF, BOM. Never evaluate spreadsheet formulas. */
export function parseCsv(input: string): string[][] {
  if (input.length > 5_000_000) throw new Error("Use a file smaller than 5 MB.");
  const text = input.replace(/^\uFEFF/, "");
  const first = text.split(/\r?\n/, 1)[0];
  const delimiter = first.includes("\t")
    ? "\t"
    : first.split(";").length > first.split(",").length
      ? ";"
      : ",";
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
    } else if (c === delimiter || c === "\n" || c === "\r") {
      row.push(cell.trim());
      cell = "";
      closed = false;
      if (c !== delimiter) {
        if (c === "\r" && text[i + 1] === "\n") i++;
        if (row.some(Boolean)) rows.push(row);
        row = [];
      }
    } else if (c === '"' && !cell && !closed) quoted = true;
    else {
      if (closed && c.trim())
        throw new Error("A quoted cell has extra text after its closing quote.");
      cell += c;
    }
  }
  if (quoted) throw new Error("A quoted cell is missing its closing quote.");
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length > 1001) throw new Error("Import up to 1,000 rows at a time.");
  if (rows.some((r) => r.length > 100)) throw new Error("Import up to 100 columns at a time.");
  return rows;
}
export function normalizeDate(input: string): string | null {
  let date = input;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(date)) {
    const [m, d, y] = date.split("/");
    date = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const value = new Date(`${date}T12:00:00Z`);
  return Number.isFinite(value.getTime()) && value.toISOString().slice(0, 10) === date
    ? date
    : null;
}
export function normalizeTime(input: string): string | null {
  if (!input) return "";
  const m = input.trim().match(/^(\d{1,2}):(\d{2})(?:\s*([ap])m)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  if (min > 59 || h > (m[3] ? 12 : 23) || (m[3] && h < 1)) return null;
  if (m[3]) h = (h % 12) + (m[3].toLowerCase() === "p" ? 12 : 0);
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}
export function validateRows(
  kind: ImportKind,
  rows: Record<string, string>[],
  defaultSeason: string,
): { rows: ImportRow[]; errors: string[]; duplicates: number } {
  const errors: string[] = [],
    result: ImportRow[] = [],
    seen = new Map<string, string>();
  let duplicates = 0;
  if (!rows.length || rows.length > 1000)
    return { rows: [], errors: ["Choose between 1 and 1,000 rows."], duplicates: 0 };
  if (!defaultSeason.trim() || defaultSeason.length > 80)
    errors.push("Enter a season label (up to 80 characters).");
  rows.forEach((raw, i) => {
    const v = Object.fromEntries(
      Object.entries(raw)
        .filter(([k]) => COLUMNS[kind].some((c) => c.key === k))
        .map(([k, value]) => [k, String(value).trim()]),
    );
    const bad = (message: string) => errors.push(`Row ${i + 2}: ${message}`);
    if (Object.values(v).some((value) => value.length > 200))
      bad("A cell is longer than 200 characters.");
    let key = "";
    if (kind === "schedule") {
      if (!v.opponent) bad("Opponent is required.");
      const date = normalizeDate(v.date ?? ""),
        time = normalizeTime(v.time ?? "");
      if (!date) bad("Use a real date as YYYY-MM-DD or M/D/YYYY.");
      if (time === null) bad("Use a start time such as 18:30 or 6:30 PM.");
      const ha = norm(v.home_away ?? "");
      if (ha && !["h", "a", "home", "away", "neutral", "n"].includes(ha))
        bad("Home / away must be home, away, or neutral.");
      v.date = date ?? "";
      v.time = time ?? "";
      v.home_away = ["a", "away"].includes(ha)
        ? "away"
        : ["n", "neutral"].includes(ha)
          ? "neutral"
          : "home";
      key = `${norm(v.opponent ?? "")}|${v.date}|${v.time}|${v.home_away}|${(v.group ?? "").trim().toLowerCase()}`;
    } else {
      if (kind === "roster" && !v.name)
        v.name = [v.first_name, v.last_name].filter(Boolean).join(" ");
      if (!v.name) bad("Player name is required.");
      if (v.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email))
        bad("Player email is invalid; leave it empty if unavailable.");
      if (v.email) v.email = v.email.toLowerCase();
      if (v.jersey && !/^\d{1,2}$/.test(v.jersey)) bad("Jersey number must be 0–99.");
      if (kind === "stats") {
        v.season ||= defaultSeason.trim();
        v.category ||= "batting";
        if (!["batting", "pitching", "combined"].includes(v.category))
          bad("Stat type must be batting, pitching, or combined.");
        let stats = 0;
        for (const column of COLUMNS.stats.filter(
          (c) => !["name", "external_id", "season", "category"].includes(c.key),
        )) {
          const value = v[column.key];
          if (!value || value === "-" || value === "—") {
            delete v[column.key];
            continue;
          }
          if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value))
            bad(`${column.key} must be a nonnegative number.`);
          else if (column.key === "IP" && !/^\d+(?:\.[012])?$/.test(value))
            bad("IP uses baseball innings, such as 12.2 (12 innings, 2 outs).");
          else if (
            !["AVG", "OBP", "SLG", "OPS", "IP", "ERA", "WHIP"].includes(column.key) &&
            !/^\d+$/.test(value)
          )
            bad(`${column.key} must be a whole number.`);
          stats++;
        }
        if (!stats) bad("Map at least one supported statistic.");
        if (v.H && v.AB && Number(v.H) > Number(v.AB)) bad("Hits cannot exceed at-bats.");
      }
      key = v.external_id ? `id:${norm(v.external_id)}` : `name:${norm(v.name ?? "")}`;
      if (kind === "stats") key += `|${norm(v.season)}|${v.category}`;
    }
    const encoded = JSON.stringify(
      Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))),
    );
    if (seen.has(key)) {
      if (seen.get(key) !== encoded)
        bad(
          "Two different rows identify the same player or game. Add distinct source player IDs or resolve the conflicting rows.",
        );
      else duplicates++;
      return;
    }
    seen.set(key, encoded);
    result.push({ key, values: v });
  });
  return { rows: result, errors, duplicates };
}
export function mapRows(
  grid: string[][],
  mapping: Record<string, number>,
): Record<string, string>[] {
  return grid
    .slice(1)
    .filter((row) => row.some(Boolean))
    .map((row) =>
      Object.fromEntries(
        Object.entries(mapping)
          .filter(([, i]) => i >= 0)
          .map(([key, i]) => [
            key,
            /^\d{4}-\d{2}-\d{2}T/.test(row[i] ?? "")
              ? key === "date"
                ? row[i].slice(0, 10)
                : key === "time"
                  ? row[i].slice(11, 16)
                  : row[i]
              : (row[i] ?? ""),
          ]),
      ),
    );
}
