import { cn } from "@/lib/utils";

export const selectClass =
  "block h-11 rounded-lg border-0 bg-white px-3 text-base text-zinc-900 ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-inset focus:ring-brand-600 sm:text-sm";

export function SelectField({
  label,
  className,
  id,
  name,
  children,
  ...props
}: React.ComponentProps<"select"> & { label: string }) {
  const selectId = id ?? name;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={selectId} className="block text-sm font-medium text-zinc-800">
        {label}
      </label>
      <select id={selectId} name={name} className={cn(selectClass, "w-full")} {...props}>
        {children}
      </select>
    </div>
  );
}
