import Link from "next/link";
import {
  formatDuration,
  formatPracticeDate,
  practiceRange,
  type PracticeSummary,
} from "@/lib/practices";

/** Phone card linking to the next published practice. */
export function NextPracticeCard({
  practice: p,
  today,
  href,
}: {
  practice: PracticeSummary;
  today: string;
  href: string;
}) {
  const when = p.date === today ? "Today" : p.date ? formatPracticeDate(p.date) : "";
  const range = practiceRange(p.startTime, p.totalMin);
  return (
    <Link
      href={href}
      data-testid="next-practice"
      className="flex items-center gap-3 rounded-2xl bg-surface p-4 ring-1 ring-zinc-200 active:bg-zinc-50"
    >
      <span
        aria-hidden
        className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-xl"
      >
        ⚾
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold tracking-wide text-brand-700 uppercase">
          Next practice · {when}
        </span>
        <span className="block truncate font-semibold">{p.title}</span>
        <span className="block truncate text-xs text-zinc-500">
          {[range ?? "Time TBA", p.totalMin ? formatDuration(p.totalMin) : null, p.location]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      <span aria-hidden className="text-zinc-400">
        →
      </span>
    </Link>
  );
}
