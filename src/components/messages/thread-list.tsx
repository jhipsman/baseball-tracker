import Link from "next/link";
import type { ThreadSummary } from "@/lib/messages";
import { cn } from "@/lib/utils";
import { formatWhen } from "./format";

export function ThreadList({
  threads,
  base,
  tz,
  empty,
}: {
  threads: ThreadSummary[];
  /** "/messages", "/player/messages" or "/parent/messages" */
  base: string;
  tz?: string;
  empty: string;
}) {
  if (!threads.length) {
    return (
      <p className="rounded-xl bg-white p-4 text-sm text-zinc-500 ring-1 ring-zinc-200">{empty}</p>
    );
  }
  return (
    <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl bg-white ring-1 ring-zinc-200">
      {threads.map((t) => (
        <li key={t.id}>
          <Link
            href={`${base}/${t.id}`}
            aria-label={`${t.title}${t.unread ? " (unread)" : ""}`}
            className="flex items-start gap-3 px-4 py-3 hover:bg-zinc-50"
          >
            <span
              aria-hidden
              data-unread={t.unread || undefined}
              className={cn(
                "mt-1.5 size-2.5 shrink-0 rounded-full",
                t.unread ? "bg-brand-600" : "bg-transparent",
              )}
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-sm",
                    t.unread ? "font-semibold text-zinc-900" : "font-medium text-zinc-800",
                  )}
                >
                  {t.title}
                </span>
                <time dateTime={t.lastMessageAt} className="shrink-0 text-xs text-zinc-500">
                  {formatWhen(t.lastMessageAt, tz)}
                </time>
              </span>
              {t.subject ? (
                <span className="block truncate text-xs text-zinc-500">
                  {t.members.map((m) => m.name).join(", ")}
                </span>
              ) : null}
              <span
                className={cn(
                  "mt-0.5 block truncate text-sm",
                  t.unread ? "text-zinc-800" : "text-zinc-500",
                )}
              >
                {t.previewAuthor ? `${t.previewAuthor}: ` : ""}
                {t.preview}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
