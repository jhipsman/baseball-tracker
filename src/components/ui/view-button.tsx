"use client";

import type { KeyboardEvent } from "react";

/**
 * A button that only opens or shows something (a diagram, a demo video).
 * It isn't a form control, so the read-only "View as" preview, which disables
 * every <button> on the page, leaves it working. Never use it to save or send.
 */
export function ViewButton({
  onPress,
  onKeyDown,
  ...props
}: Omit<React.ComponentProps<"span">, "role" | "tabIndex" | "onClick"> & {
  onPress: (e: React.MouseEvent | KeyboardEvent) => void;
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={onPress}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPress(e);
        }
      }}
      {...props}
    />
  );
}
