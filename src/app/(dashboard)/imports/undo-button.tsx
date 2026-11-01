"use client";

import { useState, useTransition } from "react";
import { undoImport } from "./actions";

export function UndoImportButton({ batchId }: { batchId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (
            !confirm(
              "Remove everything this import added? Players who have set up a login and games with stats stay.",
            )
          )
            return;
          start(async () => {
            const res = await undoImport(batchId);
            setMsg(res.error ?? "Undone.");
          });
        }}
        className="min-h-11 text-sm font-semibold text-red-700 disabled:opacity-50"
      >
        {pending ? "Undoing…" : "Undo"}
      </button>
      {msg ? <span className="text-xs text-zinc-600">{msg}</span> : null}
    </span>
  );
}
