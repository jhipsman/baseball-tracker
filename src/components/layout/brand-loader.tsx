import { cn } from "@/lib/utils";

/**
 * Between pages: the 9D diamond draws itself around the bases. It waits a
 * moment before appearing, so quick page changes show nothing at all.
 */
export function BrandLoader({ compact = false }: { compact?: boolean }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        "brand-loader grid w-full place-items-center",
        compact ? "min-h-40" : "min-h-[55vh]",
      )}
    >
      <svg
        viewBox="0 1 48 48"
        aria-hidden
        className={cn("text-brand-600", compact ? "size-10" : "size-14")}
      >
        <path
          d="M17.5 34 L8.5 25 L24 9.5 L39.5 25 L30.5 34"
          fill="none"
          stroke="currentColor"
          strokeWidth={5}
          strokeLinejoin="round"
          strokeLinecap="round"
          pathLength={100}
          className="brand-loader-path"
        />
        <path
          d="M19.4 38.6h9.2v3.6L24 46.2l-4.6-4z"
          fill="currentColor"
          stroke="currentColor"
          strokeLinejoin="round"
          className="brand-loader-plate"
        />
      </svg>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
