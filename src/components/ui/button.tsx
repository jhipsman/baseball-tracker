import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-700 text-on-brand shadow-sm shadow-brand-900/10 hover:bg-brand-600 disabled:bg-brand-700/60",
  secondary:
    "bg-surface text-zinc-900 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50 disabled:opacity-60",
  ghost: "text-zinc-700 hover:bg-zinc-100 disabled:opacity-60",
};

const base =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed";

/** Button styling for links (`<Link className={buttonClass("primary")}>`). */
export function buttonClass(variant: Variant = "primary", className?: string) {
  return cn(base, variants[variant], className);
}

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}
