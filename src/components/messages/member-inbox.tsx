import Link from "next/link";
import { requireActiveOrg } from "@/lib/org";
import { playerToday } from "@/lib/player";
import {
  loadAnnouncements,
  loadDirectory,
  loadThreads,
  markAnnouncementsRead,
} from "@/lib/messages";
import { AnnouncementList } from "./announcement-list";
import { ThreadList } from "./thread-list";
import { RefreshOnMount } from "./refresh-on-mount";

/** Phone inbox for players and parents: team announcements + conversations with coaches. */
export async function MemberInbox({ base, highlight }: { base: string; highlight?: string }) {
  const { supabase, user, org, membership } = await requireActiveOrg();
  const { tz: rawTz } = await playerToday();
  const tz = rawTz ? decodeURIComponent(rawTz) : undefined;
  const dir = await loadDirectory(supabase, org.id);
  const [announcements, threads] = await Promise.all([
    loadAnnouncements(supabase, org.id, user.id, { staff: false }),
    loadThreads(supabase, org.id, user.id, dir),
  ]);
  // Showing them counts as reading them.
  const cleared = await markAnnouncementsRead(
    supabase,
    user.id,
    announcements.filter((a) => !a.read).map((a) => a.id),
  );
  const parent = membership.role === "parent";

  return (
    <div className="space-y-6">
      {cleared ? <RefreshOnMount /> : null}
      <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>

      <section className="space-y-3" aria-labelledby="conversations-heading">
        <div className="flex items-center gap-2">
          <h2 id="conversations-heading" className="text-sm font-medium text-zinc-600">
            Conversations
          </h2>
          <Link
            href={`${base}/new`}
            className="ml-auto inline-flex h-9 items-center rounded-lg bg-brand-700 px-3 text-sm font-semibold text-white hover:bg-brand-600"
          >
            Message a coach
          </Link>
        </div>
        <ThreadList
          threads={threads}
          base={base}
          tz={tz}
          empty={
            parent
              ? "No conversations yet. You're copied on your player's conversations with coaches, and you can message a coach any time."
              : "No conversations yet. Questions about a workout, an injury, or practice? Message a coach. Your parents are copied on your conversations."
          }
        />
      </section>

      <section className="space-y-3" aria-labelledby="announcements-heading">
        <h2 id="announcements-heading" className="text-sm font-medium text-zinc-600">
          Team announcements
        </h2>
        <AnnouncementList
          items={announcements}
          staff={false}
          tz={tz}
          highlightId={highlight}
          empty="No announcements yet."
        />
      </section>
    </div>
  );
}
