import { cn } from "@/lib/utils";

export function Field({
  label,
  hint,
  className,
  id,
  name,
  ...props
}: React.ComponentProps<"input"> & { label: string; hint?: string }) {
  const inputId = id ?? name;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={inputId} className="block text-sm font-medium text-zinc-800">
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        className={cn(
          "block h-11 w-full rounded-lg border-0 bg-white px-3 text-base text-zinc-900 ring-1 ring-inset ring-zinc-300",
          "placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-brand-600 sm:text-sm",
        )}
        {...props}
      />
      {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}
