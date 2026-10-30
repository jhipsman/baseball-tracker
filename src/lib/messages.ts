import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { ROLE_LABELS, STAFF_ROLES, type OrgRole } from "@/constants";
import type { Recipient } from "@/components/messages/new-thread-form";

type Client = SupabaseClient<Database>;
type ProfileName = { full_name: string | null; email: string } | null;

const nameOf = (p: ProfileName, fallback = "Former member") =>
  p?.full_name?.trim() || p?.email || fallback;

export type Person = {
  id: string;
  name: string;
  role: OrgRole;
  /** "Coach", "Player", "Parent of Pete Pitcher"… */
  label: string;
  /** For parents: the players they're linked to. */
  childIds: string[];
};

export type Directory = {
  people: Person[];
  byId: Map<string, Person>;
  groups: { id: string; name: string; memberIds: string[] }[];
};

/** Everyone on the team (with parent links the viewer can see) and the player groups. */
export async function loadDirectory(supabase: Client, orgId: string): Promise<Directory> {
  const [{ data: members, error }, { data: links }, { data: groups }] = await Promise.all([
    supabase
      .from("org_memberships")
      .select("profile_id, role, profile:profiles (full_name, email)")
      .eq("org_id", orgId),
    supabase.from("parent_links").select("parent_id, player_id").eq("org_id", orgId),
    supabase
      .from("player_groups")
      .select("id, name, player_group_members (profile_id)")
      .eq("org_id", orgId)
      .order("name"),
  ]);
  if (error) throw error;

  const names = new Map((members ?? []).map((m) => [m.profile_id, nameOf(m.profile, "Member")]));
  const children = new Map<string, string[]>();
  for (const l of links ?? []) {
    if (!names.has(l.player_id)) continue;
    children.set(l.parent_id, [...(children.get(l.parent_id) ?? []), l.player_id]);
  }

  const people = (members ?? [])
    .map((m): Person => {
      const childIds = m.role === "parent" ? (children.get(m.profile_id) ?? []) : [];
      const label =
        m.role === "parent" && childIds.length
          ? `Parent of ${childIds.map((id) => names.get(id)).join(" & ")}`
          : ROLE_LABELS[m.role];
      return { id: m.profile_id, name: names.get(m.profile_id)!, role: m.role, label, childIds };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    people,
    byId: new Map(people.map((p) => [p.id, p])),
    groups: (groups ?? []).map((g) => ({
      id: g.id,
      name: g.name,
      memberIds: g.player_group_members.map((m) => m.profile_id),
    })),
  };
}

export const isStaffRole = (role: OrgRole) => STAFF_ROLES.includes(role);

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------

const NEW_GRACE_MS = 5 * 60 * 1000;

export type AnnouncementItem = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  includeParents: boolean;
  createdAt: string;
  groupId: string | null;
  groupName: string | null;
  authorName: string;
  /** The viewer read it more than a few minutes ago (otherwise it's shown as "New"). */
  read: boolean;
  /** Staff only: audience members (players + copied parents) who've read it. */
  readCount?: number;
  audienceSize?: number;
};

/** Announcements the viewer can see, pinned first then newest. */
export async function loadAnnouncements(
  supabase: Client,
  orgId: string,
  userId: string,
  opts: { staff: boolean; directory?: Directory; limit?: number },
): Promise<AnnouncementItem[]> {
  const { data, error } = await supabase
    .from("announcements")
    .select(
      "id, title, body, pinned, include_parents, created_at, group_id, recipient_ids, group:player_groups (name), author:profiles!announcements_author_id_fkey (full_name, email)",
    )
    .eq("org_id", orgId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 50);
  if (error) throw error;
  if (!data.length) return [];

  const ids = data.map((a) => a.id);
  let readsQuery = supabase
    .from("announcement_reads")
    .select("announcement_id, profile_id, read_at")
    .in("announcement_id", ids);
  if (!opts.staff) readsQuery = readsQuery.eq("profile_id", userId);
  const { data: reads } = await readsQuery;
  const readers = new Map<string, Set<string>>();
  // Reads from the last few minutes still count as "new" so the badge survives the
  // refresh that follows marking them read.
  const seenBefore = new Set<string>();
  const freshSince = Date.now() - NEW_GRACE_MS;
  for (const r of reads ?? []) {
    if (r.profile_id === userId && new Date(r.read_at).getTime() < freshSince) {
      seenBefore.add(r.announcement_id);
    }
    if (!readers.has(r.announcement_id)) readers.set(r.announcement_id, new Set());
    readers.get(r.announcement_id)!.add(r.profile_id);
  }

  const dir = opts.directory;
  const audience = (groupId: string | null, parents: boolean) => {
    if (!dir) return new Set<string>();
    const group = groupId ? dir.groups.find((g) => g.id === groupId) : null;
    const players = new Set(
      dir.people
        .filter((p) => p.role === "player" && (!groupId || group?.memberIds.includes(p.id)))
        .map((p) => p.id),
    );
    const out = new Set(players);
    if (parents) {
      for (const p of dir.people) {
        if (p.role === "parent" && p.childIds.some((c) => players.has(c))) out.add(p.id);
      }
    }
    return out;
  };

  return data.map((a) => {
    const who = readers.get(a.id) ?? new Set<string>();
    const item: AnnouncementItem = {
      id: a.id,
      title: a.title,
      body: a.body,
      pinned: a.pinned,
      includeParents: a.include_parents,
      createdAt: a.created_at,
      groupId: a.group_id,
      groupName: a.group?.name ?? null,
      authorName: nameOf(a.author, "Coach"),
      read: seenBefore.has(a.id),
    };
    if (opts.staff && dir) {
      const aud = a.recipient_ids
        ? new Set(a.recipient_ids)
        : audience(a.group_id, a.include_parents);
      item.audienceSize = aud.size;
      item.readCount = [...who].filter((id) => aud.has(id)).length;
    }
    return item;
  });
}

/**
 * Records that the viewer has seen these announcements and clears their notifications.
 * Returns how many notifications were cleared.
 */
export async function markAnnouncementsRead(supabase: Client, userId: string, ids: string[]) {
  if (!ids.length) return 0;
  const [, { data }] = await Promise.all([
    supabase.from("announcement_reads").upsert(
      ids.map((id) => ({ announcement_id: id, profile_id: userId })),
      { onConflict: "announcement_id,profile_id", ignoreDuplicates: true },
    ),
    supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("profile_id", userId)
      .eq("kind", "announcement")
      .is("read_at", null)
      .in(
        "href",
        ids.map((id) => `/messages?a=${id}`),
      )
      .select("id"),
  ]);
  return data?.length ?? 0;
}

// ---------------------------------------------------------------------------
// Threads
// ---------------------------------------------------------------------------

export type ThreadMember = { id: string; name: string; label: string; role: OrgRole | null };

export type ThreadSummary = {
  id: string;
  subject: string | null;
  title: string;
  lastMessageAt: string;
  preview: string;
  previewAuthor: string | null;
  unread: boolean;
  members: ThreadMember[];
};

type MemberRow = {
  profile_id: string;
  last_read_at: string | null;
  profile: ProfileName;
};

function toMembers(rows: MemberRow[], dir: Directory): ThreadMember[] {
  return rows
    .map((m) => {
      const p = dir.byId.get(m.profile_id);
      return p
        ? { id: p.id, name: p.name, label: p.label, role: p.role }
        : { id: m.profile_id, name: nameOf(m.profile), label: "No longer on the team", role: null };
    })
    .sort(
      (a, b) =>
        Number(isStaffRole(b.role ?? "player")) - Number(isStaffRole(a.role ?? "player")) ||
        a.name.localeCompare(b.name),
    );
}

function threadTitle(subject: string | null, members: ThreadMember[], userId: string) {
  if (subject) return subject;
  const others = members.filter((m) => m.id !== userId).map((m) => m.name);
  return others.length ? others.join(", ") : "Conversation";
}

const isUnread = (lastMessageAt: string, lastReadAt: string | null) =>
  !lastReadAt || new Date(lastReadAt) < new Date(lastMessageAt);

/** The viewer's conversations, newest activity first. */
export async function loadThreads(
  supabase: Client,
  orgId: string,
  userId: string,
  dir: Directory,
): Promise<ThreadSummary[]> {
  const { data, error } = await supabase
    .from("threads")
    .select(
      "id, subject, last_message_at, thread_members (profile_id, last_read_at, profile:profiles (full_name, email))",
    )
    .eq("org_id", orgId)
    .order("last_message_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  if (!data.length) return [];

  const { data: recent } = await supabase
    .from("thread_messages")
    .select("thread_id, body, author_id")
    .in(
      "thread_id",
      data.map((t) => t.id),
    )
    .order("created_at", { ascending: false })
    .limit(1000);
  const last = new Map<string, { body: string; author_id: string | null }>();
  for (const m of recent ?? []) if (!last.has(m.thread_id)) last.set(m.thread_id, m);

  return data
    .filter((t) => t.thread_members.some((m) => m.profile_id === userId))
    .map((t) => {
      const members = toMembers(t.thread_members, dir);
      const me = t.thread_members.find((m) => m.profile_id === userId);
      const msg = last.get(t.id);
      const author = msg?.author_id
        ? msg.author_id === userId
          ? "You"
          : (members.find((m) => m.id === msg.author_id)?.name ?? null)
        : null;
      return {
        id: t.id,
        subject: t.subject,
        title: threadTitle(t.subject, members, userId),
        lastMessageAt: t.last_message_at,
        preview: msg?.body ?? "",
        previewAuthor: author,
        unread: isUnread(t.last_message_at, me?.last_read_at ?? null),
        members,
      };
    });
}

export type ThreadDetail = {
  id: string;
  subject: string | null;
  title: string;
  lastMessageAt: string;
  /** The viewer hadn't read the latest message before this load. */
  unread: boolean;
  members: ThreadMember[];
  messages: {
    id: string;
    body: string;
    createdAt: string;
    authorId: string | null;
    authorName: string;
    authorLabel: string;
  }[];
};

/** One conversation with its messages, or null when it doesn't exist / isn't visible. */
export async function loadThread(
  supabase: Client,
  orgId: string,
  threadId: string,
  userId: string,
  dir: Directory,
): Promise<ThreadDetail | null> {
  const [{ data: t }, { data: msgs }] = await Promise.all([
    supabase
      .from("threads")
      .select(
        "id, subject, org_id, last_message_at, thread_members (profile_id, last_read_at, profile:profiles (full_name, email))",
      )
      .eq("id", threadId)
      .eq("org_id", orgId)
      .maybeSingle(),
    supabase
      .from("thread_messages")
      .select("id, body, created_at, author_id, author:profiles (full_name, email)")
      .eq("thread_id", threadId)
      .order("created_at")
      .limit(500),
  ]);
  if (!t || !t.thread_members.some((m) => m.profile_id === userId)) return null;
  const members = toMembers(t.thread_members, dir);
  const byId = new Map(members.map((m) => [m.id, m]));
  return {
    id: t.id,
    subject: t.subject,
    title: threadTitle(t.subject, members, userId),
    lastMessageAt: t.last_message_at,
    unread: isUnread(
      t.last_message_at,
      t.thread_members.find((m) => m.profile_id === userId)?.last_read_at ?? null,
    ),
    members,
    messages: (msgs ?? []).map((m) => {
      const who = m.author_id ? byId.get(m.author_id) : undefined;
      return {
        id: m.id,
        body: m.body,
        createdAt: m.created_at,
        authorId: m.author_id,
        authorName: who?.name ?? nameOf(m.author),
        authorLabel: who?.label ?? "",
      };
    }),
  };
}

/**
 * Moves the viewer's read marker to now and clears this thread's notifications.
 * Returns how many notifications were cleared.
 */
export async function markThreadRead(
  supabase: Client,
  threadId: string,
  userId: string,
  lastMessageAt: string,
) {
  // Never behind the last message, even if this server's clock lags the database's.
  const now = new Date(Math.max(Date.now(), new Date(lastMessageAt).getTime())).toISOString();
  const [, { data }] = await Promise.all([
    supabase
      .from("thread_members")
      .update({ last_read_at: now })
      .eq("thread_id", threadId)
      .eq("profile_id", userId),
    supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("profile_id", userId)
      .eq("kind", "message")
      .is("read_at", null)
      .eq("href", `/messages/${threadId}`)
      .select("id"),
  ]);
  return data?.length ?? 0;
}

/** How many of the viewer's conversations have unread messages. */
export async function countUnreadThreads(supabase: Client, userId: string, orgId: string) {
  const { data } = await supabase
    .from("thread_members")
    .select("last_read_at, thread:threads!inner (last_message_at, org_id)")
    .eq("profile_id", userId)
    .eq("thread.org_id", orgId);
  return (data ?? []).filter((m) => isUnread(m.thread.last_message_at, m.last_read_at)).length;
}

/** People the viewer can start a conversation with (everyone for staff; staff for others). */
export function recipientsFor(dir: Directory, userId: string, staffView: boolean): Recipient[] {
  return dir.people
    .filter((p) => p.id !== userId && (staffView || isStaffRole(p.role)))
    .map((p) => ({
      id: p.id,
      name: p.name,
      label: p.label,
      kind: isStaffRole(p.role) ? "staff" : p.role === "parent" ? "parent" : "player",
    }));
}
