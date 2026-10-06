"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string; soon?: boolean };

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        if (item.soon) {
          return (
            <span
              key={item.href}
              className="flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-zinc-400"
            >
              {item.label}
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium uppercase">
                Soon
              </span>
            </span>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-lg px-3 py-2 text-sm font-medium",
              active ? "bg-brand-50 text-brand-900" : "text-zinc-700 hover:bg-zinc-100",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
