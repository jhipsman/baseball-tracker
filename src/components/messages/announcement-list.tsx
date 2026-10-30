import type { AnnouncementItem } from "@/lib/messages";
import { cn } from "@/lib/utils";
import { formatWhen } from "./format";
import { AnnouncementControls } from "./announcement-controls";
import { ScrollIntoView } from "./scroll-into-view";

export function AnnouncementList({
  items,
  staff,
  tz,
  highlightId,
  empty,
}: {
  items: AnnouncementItem[];
  staff: boolean;
  tz?: string;
  highlightId?: string;
  empty: string;
}) {
  if (!items.length) {
    return (
      <p className="rounded-xl bg-surface p-4 text-sm text-zinc-500 ring-1 ring-zinc-200">
        {empty}
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {items.map((a) => {
        const highlighted = a.id === highlightId;
        const audience = [a.groupName ?? "Whole team", a.includeParents ? "+ parents" : null]
          .filter(Boolean)
          .join(" ");
        return (
          <li
            key={a.id}
            id={`a-${a.id}`}
            className={cn(
              "scroll-mt-20 rounded-xl bg-surface p-4 ring-1 transition-shadow",
              highlighted ? "ring-2 ring-brand-500 shadow-md" : "ring-zinc-200",
            )}
          >
            {highlighted ? <ScrollIntoView id={`a-${a.id}`} /> : null}
            <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
              <h3 className="min-w-0 flex-1 font-semibold break-words text-zinc-900">
                {a.pinned ? (
                  <span className="mr-1.5 rounded bg-amber-100 px-1.5 py-0.5 align-middle text-[11px] font-semibold text-amber-800 uppercase">
                    Pinned
                  </span>
                ) : null}
                {!staff && !a.read ? (
                  <span className="mr-1.5 rounded bg-brand-100 px-1.5 py-0.5 align-middle text-[11px] font-semibold text-brand-800 uppercase">
                    New
                  </span>
                ) : null}
                {a.title}
              </h3>
              <time dateTime={a.createdAt} className="shrink-0 text-xs text-zinc-500">
                {formatWhen(a.createdAt, tz)}
              </time>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {a.authorName} · {audience}
            </p>
            <p className="mt-2 text-sm whitespace-pre-wrap break-words text-zinc-800">{a.body}</p>
            {staff ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
                <span className="text-xs font-medium text-zinc-600">
                  {a.readCount ?? 0} of {a.audienceSize ?? 0} read
                </span>
                <AnnouncementControls id={a.id} pinned={a.pinned} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
