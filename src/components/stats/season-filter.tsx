import Link from "next/link";
import { cn } from "@/lib/utils";

/** Season (year) pills and the "Include scrimmages" toggle, as plain links. */
export function SeasonFilter({
  basePath,
  years,
  year,
  includeScrimmages,
  extra = {},
}: {
  basePath: string;
  years: number[];
  year: number;
  includeScrimmages: boolean;
  extra?: Record<string, string>;
}) {
  const href = (y: number, scrim: boolean) => {
    const q = new URLSearchParams(extra);
    q.set("year", String(y));
    if (scrim) q.set("scrim", "1");
    return `${basePath}?${q}`;
  };
  const pill = (on: boolean) =>
    cn(
      "shrink-0 rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset",
      on
        ? "bg-zinc-900 text-white ring-zinc-900"
        : "bg-white text-zinc-700 ring-zinc-300 hover:bg-zinc-50",
    );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <nav aria-label="Season" className="flex flex-wrap gap-1.5">
        {years.map((y) => (
          <Link
            key={y}
            href={href(y, includeScrimmages)}
            aria-current={y === year ? "page" : undefined}
            className={pill(y === year)}
          >
            {y}
          </Link>
        ))}
      </nav>
      <Link
        href={href(year, !includeScrimmages)}
        role="switch"
        aria-checked={includeScrimmages}
        className="inline-flex items-center gap-2 rounded-full px-1 py-1 text-sm font-medium text-zinc-700"
      >
        <span
          aria-hidden
          className={cn(
            "relative inline-block h-5 w-9 rounded-full transition-colors",
            includeScrimmages ? "bg-brand-700" : "bg-zinc-300",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-4 rounded-full bg-white shadow transition-all",
              includeScrimmages ? "left-4.5" : "left-0.5",
            )}
          />
        </span>
        Include scrimmages
      </Link>
    </div>
  );
}
