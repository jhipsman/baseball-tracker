import { hasModule, type ModuleKey } from "@/constants/modules";

export type SectionTab = { href: string; label: string; module?: ModuleKey; adminOnly?: boolean };
export type Section = {
  key: string;
  label: string;
  module?: ModuleKey;
  tabs: SectionTab[];
};

/** Coach sidebar sections; each section's pages share a tab bar. */
export const COACH_SECTIONS: Section[] = [
  { key: "dashboard", label: "Dashboard", tabs: [{ href: "/", label: "Dashboard" }] },
  {
    key: "schedule",
    label: "Schedule",
    tabs: [
      { href: "/calendar", label: "Calendar" },
      { href: "/games", label: "Games", module: "games" },
      { href: "/practices", label: "Practices", module: "practices" },
    ],
  },
  {
    key: "training",
    label: "Training",
    tabs: [
      { href: "/programs", label: "Programs" },
      { href: "/exercises", label: "Exercise library" },
    ],
  },
  {
    key: "team",
    label: "Team",
    tabs: [
      { href: "/roster", label: "Roster" },
      { href: "/roster/manage", label: "Members & invites" },
      { href: "/roster/testing", label: "Testing day" },
      { href: "/stats", label: "Stats", module: "games" },
      { href: "/imports", label: "Import", adminOnly: true },
    ],
  },
  {
    key: "health",
    label: "Player Health",
    module: "health",
    tabs: [{ href: "/throwing", label: "Throwing & arm care" }],
  },
  {
    key: "videos",
    label: "Videos",
    module: "videos",
    tabs: [{ href: "/videos", label: "Videos" }],
  },
  {
    key: "messages",
    label: "Messages",
    module: "messages",
    tabs: [{ href: "/messages", label: "Messages" }],
  },
];

export function visibleTabs(
  section: Section,
  modules: readonly string[] | null | undefined,
  isAdmin = false,
) {
  if (section.module && !hasModule(modules, section.module)) return [];
  return section.tabs.filter(
    (t) => (!t.module || hasModule(modules, t.module)) && (!t.adminOnly || isAdmin),
  );
}

/** Is `path` at `href` or below it (segment boundary)? */
export function isUnder(path: string, href: string) {
  if (href === "/") return path === "/";
  return path === href || path.startsWith(`${href}/`);
}

/** The tab whose href is the longest prefix of `path`. */
export function activeTab(path: string, tabs: SectionTab[]) {
  return tabs.filter((t) => isUnder(path, t.href)).sort((a, b) => b.href.length - a.href.length)[0];
}
