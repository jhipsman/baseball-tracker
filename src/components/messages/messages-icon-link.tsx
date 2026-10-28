import Link from "next/link";
import { requireActiveOrg } from "@/lib/org";
import { countUnreadThreads } from "@/lib/messages";

/** Header chat icon with a dot when a conversation has unread messages. */
export async function MessagesIconLink({ href }: { href: string }) {
  const { supabase, user, org } = await requireActiveOrg();
  const unread = await countUnreadThreads(supabase, user.id, org.id);
  return (
    <Link
      href={href}
      aria-label={unread ? `Messages, ${unread} unread` : "Messages"}
      className="relative inline-flex size-10 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-6"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
      </svg>
      {unread ? (
        <span className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-brand-600 ring-2 ring-white" />
      ) : null}
    </Link>
  );
}
