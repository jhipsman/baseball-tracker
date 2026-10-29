"use client";

import { hasModule } from "@/constants/modules";
import { ICONS, TabBar, type TabItem } from "./tab-bar";

export function ParentNav({ modules }: { modules: string[] }) {
  const items: TabItem[] = [
    { href: "/parent", label: "Home", icon: ICONS.home, exact: true },
    {
      href: "/parent/schedule",
      label: "Schedule",
      icon: ICONS.schedule,
      match: ["/parent/games", "/parent/practices"],
    },
  ];
  const stats = hasModule(modules, "games");
  const videos = hasModule(modules, "videos");
  if (stats || videos) {
    items.push({
      href: stats ? "/parent/stats" : "/parent/videos",
      label: "Progress",
      icon: ICONS.progress,
      match: ["/parent/stats", "/parent/videos"],
    });
  }
  if (hasModule(modules, "messages")) {
    items.push({ href: "/parent/messages", label: "Messages", icon: ICONS.messages });
  }
  return <TabBar items={items} label="Parent" keepParam="player" />;
}
