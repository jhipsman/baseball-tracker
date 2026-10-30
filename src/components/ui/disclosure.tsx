"use client";

import { useState } from "react";

/**
 * A show/hide section that remembers being open across server refreshes
 * (a plain <details open={…}> snaps shut when the page re-renders).
 */
export function Disclosure({
  label,
  openLabel = label,
  defaultOpen = false,
  children,
}: {
  label: string;
  openLabel?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 hover:text-brand-800"
      >
        {open ? openLabel : label}
      </button>
      {open ? <div className="mt-1">{children}</div> : null}
    </div>
  );
}
