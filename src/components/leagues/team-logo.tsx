import { initials } from "@/lib/leagues";
import { cn } from "@/lib/utils";

/** A team's logo, or its initials on an inverted chip when it has none. */
export function TeamLogo({
  name,
  src,
  className,
}: {
  name: string;
  src: string | null;
  className?: string;
}) {
  if (src)
    return (
      // Logos are user uploads in public storage, already resized to 512px.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={`${name} logo`}
        className={cn(
          "shrink-0 rounded-xl bg-surface object-cover ring-1 ring-zinc-200",
          className,
        )}
      />
    );
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-xl bg-zinc-900 font-bold text-zinc-50",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
