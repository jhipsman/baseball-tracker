import { ViewTransition } from "react";

/**
 * Provides a consistent page transition for route changes throughout the app.
 * The motion itself lives in globals.css (.page).
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition update={{ default: "page" }} default="none">
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
