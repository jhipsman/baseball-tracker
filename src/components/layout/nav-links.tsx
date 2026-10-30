"use client";

import Link from "next/link";
import { NavigationPending } from "./navigation-pending";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isUnder } from "@/constants/sections";

export type NavItem = { href: string; label: string; soon?: boolean; match?: string[] };

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 md:flex-col md:flex-nowrap">
      {items.map((item) => {
        const active = (item.match ?? [item.href]).some((h) => isUnder(pathname, h));
        if (item.soon) {
          return (
            <span
              key={item.href}
              className="flex shrink-0 items-center justify-between gap-2 rounded-full px-4 py-2 text-sm text-zinc-400"
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
              "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-zinc-900 text-zinc-50 shadow-sm"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
            )}
          >
            {item.label}
            <NavigationPending />
          </Link>
        );
      })}
    </nav>
  );
}
