"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  {
    href: "/player",
    label: "Today",
    icon: "M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  },
  {
    href: "/player/throwing",
    label: "Throwing",
    // a baseball: circle with two seams
    icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM5.6 6.6c2.2 1.6 3.4 3.4 3.4 5.4s-1.2 3.8-3.4 5.4M18.4 6.6c-2.2 1.6-3.4 3.4-3.4 5.4s1.2 3.8 3.4 5.4",
  },
  {
    href: "/player/videos",
    label: "Videos",
    // video camera
    icon: "M3 7a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM16 10l5-3v10l-5-3",
  },
  {
    href: "/player/history",
    label: "History",
    icon: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  },
  {
    href: "/player/profile",
    label: "Profile",
    icon: "M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM4 21a8 8 0 0 1 16 0",
  },
];

export function PlayerNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Player"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex max-w-md">
        {ITEMS.map((item) => {
          const active =
            item.href === "/player"
              ? pathname === "/player" || pathname.startsWith("/player/log")
              : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-0.5 text-xs font-medium",
                  active ? "text-brand-700" : "text-zinc-500",
                )}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="size-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d={item.icon} />
                </svg>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
