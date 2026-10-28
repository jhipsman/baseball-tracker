"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteAnnouncement, setAnnouncementPinned } from "@/lib/message-actions";

export function AnnouncementControls({ id, pinned }: { id: string; pinned: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      const res = await fn();
      setError(res.error ?? null);
      if (!res.error) router.refresh();
    });

  return (
    <div className="ml-auto flex items-center gap-1">
      {error ? (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      ) : null}
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => setAnnouncementPinned(id, !pinned))}
        className="rounded-md px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
      >
        {pinned ? "Unpin" : "Pin"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (window.confirm("Delete this announcement for everyone?")) {
            run(() => deleteAnnouncement(id));
          }
        }}
        className="rounded-md px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  );
}
