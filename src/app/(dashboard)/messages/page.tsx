import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { playerToday } from "@/lib/player";
import { loadAnnouncements, loadDirectory, loadThreads } from "@/lib/messages";
import { AnnouncementList } from "@/components/messages/announcement-list";
import { AnnouncementForm } from "@/components/messages/announcement-form";
import { ThreadList } from "@/components/messages/thread-list";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage({ searchParams }: PageProps<"/messages">) {
  const { supabase, user, org, isStaff } = await requireActiveOrg();
  const sp = await searchParams;
  const highlight = typeof sp.a === "string" ? sp.a : undefined;
  if (!isStaff)
    redirect(
      highlight ? `/player/messages?a=${encodeURIComponent(highlight)}` : "/player/messages",
    );

  const tab =
    sp.tab === "announcements" || (highlight && sp.tab !== "conversations")
      ? "announcements"
      : "conversations";
  const { tz: rawTz } = await playerToday();
  const tz = rawTz ? decodeURIComponent(rawTz) : undefined;
  const dir = await loadDirectory(supabase, org.id);
  const [threads, announcements] = await Promise.all([
    loadThreads(supabase, org.id, user.id, dir),
    loadAnnouncements(supabase, org.id, user.id, { staff: true, directory: dir }),
  ]);
  const unread = threads.filter((t) => t.unread).length;

  const tabs = [
    { key: "conversations", label: `Conversations${unread ? ` (${unread})` : ""}` },
    { key: "announcements", label: "Announcements" },
  ] as const;

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Post announcements to the team or a group, and message players, parents, and staff.
          Parents are copied on conversations with their player.
        </p>
      </div>

      <nav className="flex gap-1" aria-label="Messages sections">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/messages?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium",
              tab === t.key
                ? "bg-zinc-900 text-white"
                : "bg-white text-zinc-700 ring-1 ring-zinc-300",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "conversations" ? (
        <section className="max-w-3xl space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold">Conversations</h2>
            <Link
              href="/messages/new"
              className="ml-auto inline-flex h-10 items-center rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-600"
            >
              New message
            </Link>
          </div>
          <ThreadList
            threads={threads}
            base="/messages"
            tz={tz}
            empty="No conversations yet. Start one with a player, a parent, or another coach."
          />
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <aside className="h-fit rounded-xl bg-white p-4 ring-1 ring-zinc-200 lg:col-start-2 lg:row-start-1">
            <h2 className="mb-3 font-semibold">New announcement</h2>
            <AnnouncementForm groups={dir.groups} />
          </aside>
          <section className="min-w-0 space-y-3 lg:col-start-1 lg:row-start-1">
            <h2 className="font-semibold">Announcements</h2>
            <AnnouncementList
              items={announcements}
              staff
              tz={tz}
              highlightId={highlight}
              empty="No announcements yet. Post one and it shows up on everyone's phone."
            />
          </section>
        </div>
      )}
    </div>
  );
}
