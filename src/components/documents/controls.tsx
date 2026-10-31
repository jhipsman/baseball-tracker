"use client";

import { useState, useTransition } from "react";
import { openFile, remindDocument, setDocumentArchived } from "@/lib/document-actions";
import { ViewButton } from "@/components/ui/view-button";
import { cn } from "@/lib/utils";

/** Opens a private file through a short-lived link (works in View-as preview too). */
export function OpenFile({
  path,
  children,
  className,
}: {
  path: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [error, setError] = useState("");
  return (
    <span className="inline-flex flex-col">
      <ViewButton
        onPress={async () => {
          setError("");
          // Open the tab right away (phones block pop-ups opened after a wait).
          const tab = window.open("about:blank", "_blank");
          const res = await openFile(path);
          if (res.url && tab) tab.location.href = res.url;
          else {
            tab?.close();
            if (res.url) location.href = res.url;
            else setError(res.error ?? "Couldn't open it.");
          }
        }}
        className={cn("cursor-pointer font-semibold text-brand-700 hover:underline", className)}
      >
        {children}
      </ViewButton>
      {error ? <span className="text-xs text-red-700">{error}</span> : null}
    </span>
  );
}

export function RemindButton({ docId, missing }: { docId: string; missing: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!missing) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await remindDocument(docId);
            setMsg(
              res.error
                ? { ok: false, text: res.error }
                : { ok: true, text: `Reminder sent (${res.sent} people).` },
            );
          })
        }
        className="h-11 rounded-full bg-zinc-900 px-4 text-sm font-semibold text-zinc-50 disabled:opacity-60"
      >
        {pending ? "Sending…" : `Remind the ${missing} who haven't`}
      </button>
      {msg ? (
        <span role="status" className={msg.ok ? "text-sm text-brand-800" : "text-sm text-red-700"}>
          {msg.text}
        </span>
      ) : null}
    </span>
  );
}

export function ArchiveButton({ docId, archived }: { docId: string; archived: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => void (await setDocumentArchived(docId, !archived)))}
      className="h-11 rounded-full px-4 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-300 disabled:opacity-60"
    >
      {pending ? "Saving…" : archived ? "Restore" : "Archive"}
    </button>
  );
}
