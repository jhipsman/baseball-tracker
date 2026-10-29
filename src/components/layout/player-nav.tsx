"use client";

import { hasModule } from "@/constants/modules";
import { ICONS, TabBar, type TabItem } from "./tab-bar";

export function PlayerNav({ modules }: { modules: string[] }) {
  const items: TabItem[] = [
    { href: "/player", label: "Today", icon: ICONS.home, exact: true, match: ["/player/log"] },
  ];
  if (hasModule(modules, "games")) {
    items.push({
      href: "/player/games",
      label: "Schedule",
      icon: ICONS.schedule,
      match: ["/player/practices"],
    });
  }
  if (hasModule(modules, "health")) {
    items.push({ href: "/player/throwing", label: "Health", icon: ICONS.health });
  }
  if (hasModule(modules, "videos")) {
    items.push({ href: "/player/videos", label: "Videos", icon: ICONS.videos });
  }
  items.push({
    href: "/player/profile",
    label: "Me",
    icon: ICONS.me,
    match: ["/player/history", "/player/stats"],
  });
  return <TabBar items={items} label="Player" />;
}
