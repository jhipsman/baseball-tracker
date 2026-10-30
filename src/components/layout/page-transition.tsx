import { ViewTransition } from "react";

/**
 * Animates the page area when the user moves between pages from a menu
 * (links tagged `transitionTypes={["nav"]}`). Saves, refreshes and the live
 * scorer's updates don't animate. The motion itself lives in globals.css (.page).
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition update={{ nav: "page", default: "none" }} default="none">
      {children}
    </ViewTransition>
  );
}

/** The selected-tab highlight; glides between tabs (globals.css, .pill). */
export function TabPill({ name, className }: { name: string; className: string }) {
  return (
    <ViewTransition name={name} share="pill" default="none">
      <span aria-hidden className={className} />
    </ViewTransition>
  );
}

export const NAV = ["nav"];
