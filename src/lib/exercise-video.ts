/**
 * Exercise demo videos.
 *
 * Coaches paste a YouTube or Vimeo link (or a direct https MP4) on a custom
 * exercise. We never embed the pasted URL itself: it is parsed and rebuilt as an
 * embed URL on a fixed, known host, so nothing else (javascript:, other sites,
 * look-alike domains) can end up in an iframe.
 */

export type DemoVideo =
  | { kind: "youtube"; id: string; embedUrl: string; vertical: boolean }
  | { kind: "vimeo"; id: string; embedUrl: string; vertical: false }
  | { kind: "file"; src: string; vertical: false };

export const DEMO_URL_MAX_LENGTH = 500;

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);
const YOUTUBE_SHORT_HOSTS = new Set(["youtu.be", "www.youtu.be"]);
const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"]);

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{1,12}$/;
const VIMEO_HASH = /^[0-9a-f]{6,20}$/i;

/** "90", "90s", "1m30s", "1h2m3s" → seconds. Anything else → null. */
export function parseStartTime(value: string | null): number | null {
  if (!value) return null;
  if (/^\d+$/.test(value)) return clampStart(Number(value));
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  return clampStart(Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0));
}

function clampStart(n: number) {
  return Number.isFinite(n) && n > 0 && n < 86_400 ? Math.floor(n) : null;
}

function youtube(id: string | undefined | null, url: URL, vertical: boolean): DemoVideo | null {
  if (!id || !YOUTUBE_ID.test(id)) return null;
  // `t` may also live in the fragment (#t=1m30s).
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const start =
    parseStartTime(url.searchParams.get("start")) ??
    parseStartTime(url.searchParams.get("t")) ??
    parseStartTime(hash.get("t"));
  const params = new URLSearchParams({ rel: "0", playsinline: "1" });
  if (start) params.set("start", String(start));
  return {
    kind: "youtube",
    id,
    vertical,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}?${params}`,
  };
}

function vimeo(id: string | undefined, hash: string | null): DemoVideo | null {
  if (!id || !VIMEO_ID.test(id)) return null;
  const h = hash && VIMEO_HASH.test(hash) ? `?h=${hash}` : "";
  return {
    kind: "vimeo",
    id,
    vertical: false,
    embedUrl: `https://player.vimeo.com/video/${id}${h}`,
  };
}

/**
 * Parse a demo link into something safe to play, or null if it isn't a supported
 * YouTube / Vimeo / https MP4 link.
 */
export function parseDemoVideo(input: string | null | undefined): DemoVideo | null {
  const raw = (input ?? "").trim();
  if (!raw || raw.length > DEMO_URL_MAX_LENGTH) return null;

  let url: URL;
  try {
    // Allow "youtube.com/watch?v=…" without a scheme, but never any other scheme.
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password || url.port) return null;

  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);

  if (YOUTUBE_SHORT_HOSTS.has(host)) return youtube(parts[0], url, false);

  if (YOUTUBE_HOSTS.has(host)) {
    if (parts[0] === "watch") return youtube(url.searchParams.get("v"), url, false);
    if (parts[0] === "shorts") return youtube(parts[1], url, true);
    if (["embed", "live", "v"].includes(parts[0])) return youtube(parts[1], url, false);
    return null;
  }

  if (VIMEO_HOSTS.has(host)) {
    if (host === "player.vimeo.com") {
      return parts[0] === "video" ? vimeo(parts[1], url.searchParams.get("h")) : null;
    }
    // vimeo.com/123, vimeo.com/123/abcdef (unlisted), vimeo.com/channels/x/123,
    // vimeo.com/groups/x/videos/123
    const idx = parts.findIndex((p) => VIMEO_ID.test(p));
    if (idx === -1) return null;
    return vimeo(parts[idx], parts[idx + 1] ?? url.searchParams.get("h"));
  }

  // A direct video file: https only (no mixed content), mp4/webm.
  if (url.protocol === "https:" && /\.(mp4|m4v|webm)$/i.test(url.pathname)) {
    return { kind: "file", src: url.href, vertical: false };
  }
  return null;
}

/** YouTube search for when an exercise has no demo of its own. */
export function demoSearchUrl(exerciseName: string) {
  const q = `${exerciseName} exercise demo`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q).replace(/%20/g, "+")}`;
}
