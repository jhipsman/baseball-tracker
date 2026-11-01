import type { Platform } from "@/lib/imports/smart";

/**
 * How to get each kind of data out of the app a team uses today. Menus move
 * around between versions, so steps say what to look for, not exact clicks.
 */
export type Guide = { roster: string[]; schedule: string[]; stats?: string[]; note?: string };

export const PLATFORMS: { key: Platform; name: string; blurb: string }[] = [
  { key: "gamechanger", name: "GameChanger", blurb: "Stats, schedule and players" },
  { key: "teamsnap", name: "TeamSnap", blurb: "Roster with parents, schedule" },
  { key: "leagueapps", name: "LeagueApps", blurb: "Registrations with parents, schedules" },
  { key: "sportsengine", name: "SportsEngine", blurb: "Members, schedule" },
  { key: "sheets", name: "Google Sheets or Excel", blurb: "Any spreadsheet" },
  { key: "other", name: "Something else", blurb: "Any CSV, Excel or calendar file" },
];

export const GUIDES: Record<Platform, Guide> = {
  gamechanger: {
    roster: [
      "GameChanger doesn't export a roster on its own. Use the season stats export below: it lists every player with their number, and 9D can make your roster from it.",
      "Or copy your roster into a Google Sheet (name, number, position, parent email) and upload that.",
    ],
    schedule: [
      "In the GameChanger app: Schedule → Sync / Subscribe to calendar → copy the calendar link.",
      "Paste that link here (or download the .ics file and upload it). Games and practices both come over.",
    ],
    stats: [
      "On gc.com (staff account): open your team → Stats → Export Stats. It downloads a CSV.",
      "Upload it as is. 9D reads the Batting and Pitching sections and makes a line for each.",
    ],
  },
  teamsnap: {
    roster: [
      "On teamsnap.com: open your team → Roster → Export → Export CSV File.",
      "Upload it as is. Parent emails (p1email, p2email) become parent invitations, and Non-Players (coaches, managers) are skipped.",
    ],
    schedule: [
      "On teamsnap.com: Schedule → Export / Subscribe → copy the calendar link (or download the .ics file).",
      "Paste the link or upload the file. Practices and games are told apart automatically.",
    ],
    note: "Club admins: export each team's roster, or an organization member export with a Team column; each team becomes a group.",
  },
  leagueapps: {
    roster: [
      "In the LeagueApps admin: Programs → your program → Registrations (or Members) → Export / Download CSV. Include parent / guardian fields if it asks.",
      "Upload it as is. Cancelled, withdrawn and waitlisted registrations are skipped, the Team column becomes groups, and players listed once per parent are merged.",
    ],
    schedule: [
      "In the LeagueApps admin: your program → Schedule → Export (CSV), or copy the team calendar's subscribe link.",
      "If the file lists Home Team and Away Team, you'll pick which one is you; other teams' games are skipped.",
    ],
    note: "Club with several programs? Export each program (or one export with Program and Team columns) and import them one at a time.",
  },
  sportsengine: {
    roster: [
      "In SportsEngine HQ: Members → Directory → filter to your team → Export (current view or all) as CSV.",
      "Upload it as is. Guardian emails become parent invitations.",
    ],
    schedule: [
      "On your team's SportsEngine page: Calendar → Subscribe (iCal) → copy the link, or export the schedule.",
      "Paste the link or upload the file.",
    ],
  },
  sheets: {
    roster: [
      "One row per player with headings in the first row: Name (or First / Last), Number, Position, Birthday, Parent email, Player email, Team.",
      "Google Sheets: File → Download → CSV or Excel. Or select the cells, copy, and paste them here.",
    ],
    schedule: [
      "Headings: Date, Time, Opponent, Home/Away, Location. Add a Type column with Game or Practice if you mix them.",
      "Upload the file or paste the cells.",
    ],
    stats: [
      "Headings: Name, then stats (G, PA, AB, H, 2B, 3B, HR, RBI, BB, SO, SB, AVG… or IP, ER, ERA for pitching).",
    ],
  },
  other: {
    roster: [
      "Export your roster as CSV or Excel from the app you use (look for Export or Download).",
      "Upload it; 9D matches the columns and you can fix any it gets wrong.",
    ],
    schedule: [
      "Most apps can share a calendar link (Subscribe / iCal / webcal). Paste it here, or upload a CSV or .ics file.",
    ],
    stats: ["Export season stats as CSV or Excel and upload it."],
  },
};
