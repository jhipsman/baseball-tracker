/** 9D Leagues: pure helpers for public team pages (no data access). */
import type { PublicTeamGame, PublicTeamRow } from "@/types/team-operations";

export const LEVELS: { key: PublicTeamRow["level"]; label: string }[] = [
  { key: "youth", label: "Youth / Little League" },
  { key: "middle_school", label: "Middle school" },
  { key: "high_school", label: "High school" },
  { key: "travel", label: "Travel / club" },
  { key: "college", label: "College" },
  { key: "adult", label: "Adult / men's league" },
];
export const levelLabel = (key: string) => LEVELS.find((l) => l.key === key)?.label ?? "Team";

/** "Riverside Rays 14U", "Austin" → "riverside-rays-14u-austin". */
export function teamSlug(...parts: (string | null | undefined)[]) {
  const s = parts
    .filter(Boolean)
    .join(" ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return s.length >= 3 ? s : `team-${s || "page"}`;
}

export type Result = "W" | "L" | "T";
export function result(g: Pick<PublicTeamGame, "status" | "team_score" | "opponent_score">) {
  if (g.status !== "final" || g.team_score == null || g.opponent_score == null) return null;
  return (
    g.team_score > g.opponent_score ? "W" : g.team_score < g.opponent_score ? "L" : "T"
  ) as Result;
}

/** Win-loss(-tie) record, runs and the current streak from final games. */
export function record(
  games: Pick<PublicTeamGame, "date" | "status" | "team_score" | "opponent_score">[],
) {
  const finals = games
    .map((g) => ({ g, r: result(g) }))
    .filter((x): x is { g: (typeof games)[number]; r: Result } => x.r != null)
    .sort((a, b) => a.g.date.localeCompare(b.g.date));
  const count = (r: Result) => finals.filter((x) => x.r === r).length;
  const w = count("W"),
    l = count("L"),
    t = count("T");
  let streak = "";
  if (finals.length) {
    const last = finals[finals.length - 1].r;
    let n = 0;
    for (let i = finals.length - 1; i >= 0 && finals[i].r === last; i--) n++;
    streak = `${last}${n}`;
  }
  return {
    w,
    l,
    t,
    text: t ? `${w}-${l}-${t}` : `${w}-${l}`,
    runsFor: finals.reduce((s, x) => s + (x.g.team_score ?? 0), 0),
    runsAgainst: finals.reduce((s, x) => s + (x.g.opponent_score ?? 0), 0),
    streak,
  };
}

/** "vs Eagles" / "@ Eagles". */
export const matchup = (g: Pick<PublicTeamGame, "home_away" | "opponent">) =>
  `${g.home_away === "away" ? "@" : "vs"} ${g.opponent}`;

/** "6:30 PM" from "18:30:00". */
export function clock(t: string | null) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** Public URL of a team logo in storage. */
export const logoUrl = (path: string | null | undefined) =>
  path
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/team-logos/${path}`
    : null;

/** "Riverside Rays" → "RR" for teams without a logo. */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /[a-z0-9]/i.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

/** Same game? (date plus opponent, ignoring case, spaces and punctuation). */
export const gameKey = (date: string, opponent: string) =>
  `${date}|${opponent.toLowerCase().replace(/[^a-z0-9]+/g, "")}`;
