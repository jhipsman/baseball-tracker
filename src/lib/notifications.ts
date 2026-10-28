import type { OrgRole } from "@/constants";

/** Notification kinds (must match the check constraint on public.notifications). */
export const NOTIFICATION_KINDS = [
  { key: "announcement", label: "Team announcements" },
  { key: "message", label: "Messages" },
  { key: "video_reviewed", label: "Video reviews" },
  { key: "video_uploaded", label: "New player videos" },
  { key: "arm_pain", label: "Arm pain alerts" },
  { key: "practice", label: "Practice plans" },
  { key: "program_assigned", label: "New programs" },
  { key: "game", label: "Game changes & final scores" },
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]["key"];

const KIND_KEYS = new Set<string>(NOTIFICATION_KINDS.map((k) => k.key));
export const isNotificationKind = (v: unknown): v is NotificationKind =>
  typeof v === "string" && KIND_KEYS.has(v);

const ROLE_KINDS: Record<"staff" | "player" | "parent", readonly NotificationKind[]> = {
  staff: ["announcement", "message", "video_uploaded", "arm_pain"],
  player: ["announcement", "message", "video_reviewed", "practice", "program_assigned", "game"],
  parent: ["announcement", "message", "video_reviewed", "arm_pain", "practice", "game"],
};

/** The kinds a role can actually receive (for the push mute list). */
export function kindsForRole(role: OrgRole) {
  const allowed = ROLE_KINDS[role === "player" || role === "parent" ? role : "staff"];
  return NOTIFICATION_KINDS.filter((k) => allowed.includes(k.key));
}

/** Where each role's app starts. */
export function homeFor(role: OrgRole) {
  if (role === "player") return "/player";
  if (role === "parent") return "/parent";
  return "/";
}

/** True for a same-origin relative path ("/x"), never "//host" or "/\host". */
export function isSafeRelative(href: string | null | undefined): href is string {
  return (
    typeof href === "string" &&
    href.startsWith("/") &&
    !href.startsWith("//") &&
    !href.startsWith("/\\") &&
    !/[\u0000-\u001f\\]/.test(href)
  );
}

/** Does `href` sit at `prefix` or below it ("/messages", "/messages/x", "/messages?a=1")? */
function under(href: string, prefix: string) {
  if (!href.startsWith(prefix)) return false;
  const next = href.charAt(prefix.length);
  return next === "" || next === "/" || next === "?" || next === "#";
}

/**
 * Maps a stored, role-neutral notification href to the page for the viewer's role.
 * Anything that isn't a safe relative path falls back to the role's home.
 */
export function hrefForRole(href: string | null | undefined, role: OrgRole): string {
  const home = homeFor(role);
  if (!isSafeRelative(href)) return home;

  if (role === "player") {
    if (under(href, "/messages")) return `/player${href}`;
    if (under(href, "/practices")) return `/player${href}`;
    if (under(href, "/games")) return `/player${href}`;
    if (under(href, "/parent/videos")) return href.replace("/parent/videos", "/player/videos");
    if (under(href, "/parent")) return "/player";
    return href;
  }

  if (role === "parent") {
    if (under(href, "/messages")) return `/parent${href}`;
    if (under(href, "/practices")) return `/parent${href}`;
    if (under(href, "/games")) return `/parent${href}`;
    if (under(href, "/player/videos")) return href.replace("/player/videos", "/parent/videos");
    if (under(href, "/player")) return "/parent";
    return href;
  }

  return href;
}
