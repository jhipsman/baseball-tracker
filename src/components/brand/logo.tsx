import { BRAND } from "@/constants/brand";
import { cn } from "@/lib/utils";

/**
 * 9D mark: the infield drawn from its four base paths, open at
 * home plate, which sits just below. Takes the current text color, so it
 * works in Day and Night mode. Same drawing as public/icons/*.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 1 48 48" aria-hidden className={cn("shrink-0", className)}>
      <path
        d="M17.5 34 L8.5 25 L24 9.5 L39.5 25 L30.5 34"
        fill="none"
        stroke="currentColor"
        strokeWidth={5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M19.4 38.6h9.2v3.6L24 46.2l-4.6-4z"
        fill="currentColor"
        stroke="currentColor"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The mark with the "9D" wordmark (Barlow Condensed Italic). */
export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={cn("size-8 text-brand-600", markClassName)} />
      <span className="font-wordmark text-[1.9em] leading-none tracking-tight italic">
        {BRAND.name}
      </span>
    </span>
  );
}
