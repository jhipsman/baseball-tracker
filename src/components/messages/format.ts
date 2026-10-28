/** Short, human time for a message: "3:42 PM", "Mon 3:42 PM", "Oct 3", or "Oct 3, 2025". */
export function formatWhen(iso: string, tz?: string, now: Date = new Date()) {
  const d = new Date(iso);
  let timeZone = tz || undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
  } catch {
    timeZone = undefined;
  }
  const day = (x: Date) => x.toLocaleDateString("en-CA", { timeZone });
  const time = d.toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
  if (day(d) === day(now)) return time;
  const ageDays = (now.getTime() - d.getTime()) / 86400000;
  if (ageDays < 6 && ageDays > 0) {
    return `${d.toLocaleDateString("en-US", { timeZone, weekday: "short" })} ${time}`;
  }
  const sameYear =
    d.toLocaleDateString("en-US", { timeZone, year: "numeric" }) ===
    now.toLocaleDateString("en-US", { timeZone, year: "numeric" });
  return d.toLocaleDateString("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    (parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")
  ).toUpperCase();
}
