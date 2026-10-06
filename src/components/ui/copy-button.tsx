"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function CopyButton({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          window.prompt("Copy this link:", value);
        }
      }}
      className={cn(
        "rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50",
        className,
      )}
    >
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}
