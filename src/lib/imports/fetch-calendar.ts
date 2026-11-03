const PRIVATE = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^::1$/,
  /^f[cd]/i,
  /^fe80/i,
  /^::ffff:(127|10|192\.168|169\.254)\./i,
];

/**
 * Download a calendar subscription link (webcal:// or https://) a team copies
 * from TeamSnap, GameChanger, SportsEngine, LeagueApps or Google Calendar.
 * Public internet addresses only; no redirects; 2 MB; 10 seconds.
 */
/**
 * Download a public calendar (.ics) from a webcal:// or https:// link. Only
 * public https hosts are allowed (checked on every redirect), with a size cap.
 */
export async function downloadCalendar(link: string): Promise<{ error?: string; text?: string }> {
  let url: URL;
  try {
    url = new URL(
      String(link)
        .trim()
        .replace(/^webcals?:\/\//i, "https://"),
    );
  } catch {
    return { error: "Paste the full calendar link (it starts with webcal:// or https://)." };
  }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443"))
    return { error: "Use the calendar's https:// or webcal:// link." };
  const { lookup } = await import("node:dns/promises");
  const isPublic = async (u: URL) => {
    if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443"))
      return false;
    try {
      const addrs = await lookup(u.hostname, { all: true });
      return addrs.length > 0 && !addrs.some((x) => PRIVATE.some((re) => re.test(x.address)));
    } catch {
      return false;
    }
  };
  try {
    let res: Response | null = null;
    for (let hop = 0; hop < 4; hop++) {
      if (!(await isPublic(url)))
        return { error: "That link can't be opened. Check it and try again." };
      res = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(10_000),
        headers: { Accept: "text/calendar, text/plain;q=0.8" },
      });
      const next = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
      if (!next) break;
      url = new URL(next, url);
      res = null;
    }
    if (!res) return { error: "That link redirects too many times." };
    if (!res.ok) return { error: `The calendar didn't load (${res.status}). Is it public?` };
    const reader = res.body?.getReader();
    if (!reader) return { error: "The calendar was empty." };
    let size = 0;
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2_000_000) return { error: "That calendar is too big (over 2 MB)." };
      chunks.push(value);
    }
    const text = new TextDecoder().decode(Buffer.concat(chunks));
    if (!text.includes("BEGIN:VCALENDAR")) return { error: "That link isn't a calendar file." };
    return { text };
  } catch {
    return { error: "The calendar didn't load. Try again, or download the .ics file instead." };
  }
}
