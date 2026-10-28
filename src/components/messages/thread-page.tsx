import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { playerToday } from "@/lib/player";
import { loadDirectory, loadThread, markThreadRead } from "@/lib/messages";
import { cn } from "@/lib/utils";
import { formatWhen, initials } from "./format";
import { ReplyForm } from "./reply-form";
import { RefreshOnMount } from "./refresh-on-mount";

/** A conversation: messages, reply box, and who's in it. Shared by coach, player and parent. */
export async function ThreadPage({ id, base }: { id: string; base: string }) {
  const { supabase, user, org } = await requireActiveOrg();
  const { tz: rawTz } = await playerToday();
  const tz = rawTz ? decodeURIComponent(rawTz) : undefined;
  const dir = await loadDirectory(supabase, org.id);
  const thread = await loadThread(supabase, org.id, id, user.id, dir);
  if (!thread) notFound();
  const cleared = await markThreadRead(supabase, thread.id, user.id, thread.lastMessageAt);
  const parentsCopied = thread.members.some((m) => m.role === "parent");

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      {cleared || thread.unread ? <RefreshOnMount /> : null}
      <div>
        <Link href={base} className="text-sm font-medium text-brand-700">
          ← Messages
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight break-words">{thread.title}</h1>
        <details className="mt-1 text-sm text-zinc-600">
          <summary className="cursor-pointer">
            {thread.members.length} people in this conversation
          </summary>
          <ul className="mt-2 space-y-1 rounded-xl bg-white p-3 ring-1 ring-zinc-200">
            {thread.members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium text-zinc-900">
                  {m.name}
                  {m.id === user.id ? " (you)" : ""}
                </span>
                <span className="text-xs text-zinc-500">{m.label}</span>
              </li>
            ))}
          </ul>
          {parentsCopied ? (
            <p className="mt-2 text-xs text-zinc-500">
              Parents are copied on conversations with their player.
            </p>
          ) : null}
        </details>
      </div>

      <ol className="space-y-3" aria-label="Messages">
        {thread.messages.map((m) => {
          const mine = m.authorId === user.id;
          return (
            <li key={m.id} className={cn("flex gap-2", mine && "flex-row-reverse")}>
              <span
                aria-hidden
                className={cn(
                  "mt-5 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  mine ? "bg-brand-100 text-brand-800" : "bg-zinc-200 text-zinc-700",
                )}
              >
                {initials(m.authorName)}
              </span>
              <div className={cn("min-w-0 max-w-[85%]", mine && "text-right")}>
                <p className="truncate text-xs text-zinc-500">
                  <span className="font-medium text-zinc-700">{mine ? "You" : m.authorName}</span>
                  {!mine && m.authorLabel ? ` · ${m.authorLabel}` : ""} ·{" "}
                  <time dateTime={m.createdAt}>{formatWhen(m.createdAt, tz)}</time>
                </p>
                <div
                  className={cn(
                    "mt-1 inline-block rounded-2xl px-3 py-2 text-left text-sm whitespace-pre-wrap break-words",
                    mine
                      ? "bg-brand-700 text-white"
                      : "bg-white text-zinc-900 ring-1 ring-zinc-200",
                  )}
                >
                  {m.body}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="rounded-xl bg-white p-3 ring-1 ring-zinc-200">
        <ReplyForm threadId={thread.id} />
      </div>
    </div>
  );
}
