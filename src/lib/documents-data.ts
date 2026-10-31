import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { DocumentResponseRow, TeamDocumentRow } from "@/types/team-operations";

type Client = SupabaseClient<Database>;
export type Person = { id: string; name: string };

/** Players on the team with their groups, and the staff, for working out who owes what. */
export async function loadDocPeople(supabase: Client, orgId: string) {
  const [{ data: members }, { data: groups }] = await Promise.all([
    supabase
      .from("org_memberships")
      .select("profile_id, role, profile:profiles (full_name, email)")
      .eq("org_id", orgId),
    supabase
      .from("player_groups")
      .select("id, name, player_group_members (profile_id)")
      .eq("org_id", orgId),
  ]);
  const name = (m: NonNullable<typeof members>[number]) => m.profile.full_name || m.profile.email;
  const players: Person[] = (members ?? [])
    .filter((m) => m.role === "player")
    .map((m) => ({ id: m.profile_id, name: name(m) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const staff: Person[] = (members ?? [])
    .filter((m) => m.role === "admin" || m.role === "coach")
    .map((m) => ({ id: m.profile_id, name: name(m) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const groupList = (groups ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    memberIds: g.player_group_members.map((m) => m.profile_id),
  }));
  return { players, staff, groups: groupList };
}

/** Who a document is for: players (in its group) for family forms, coaches for staff forms. */
export function expectedFor(
  doc: Pick<TeamDocumentRow, "audience" | "group_id">,
  people: Awaited<ReturnType<typeof loadDocPeople>>,
): Person[] {
  if (doc.audience === "staff") return people.staff;
  const group = doc.group_id ? people.groups.find((g) => g.id === doc.group_id) : null;
  return group ? people.players.filter((p) => group.memberIds.includes(p.id)) : people.players;
}

export async function loadDocuments(supabase: Client, orgId: string) {
  const [{ data: docs }, { data: responses }] = await Promise.all([
    supabase
      .from("team_documents")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
    supabase.from("document_responses").select("*").eq("org_id", orgId),
  ]);
  return {
    docs: (docs ?? []) as TeamDocumentRow[],
    responses: (responses ?? []) as DocumentResponseRow[],
  };
}

/**
 * What a player or parent still has to do: family forms for themselves (a
 * player) or each linked child (a parent), in the form's group if it has one.
 */
export async function loadFamilyTasks(
  supabase: Client,
  orgId: string,
  userId: string,
  role: "player" | "parent",
) {
  let subjects: Person[] = [];
  if (role === "player") {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .single();
    subjects = [{ id: userId, name: data?.full_name || data?.email || "You" }];
  } else {
    const { data } = await supabase
      .from("parent_links")
      .select("player_id, player:profiles!parent_links_player_id_fkey (full_name, email)")
      .eq("org_id", orgId)
      .eq("parent_id", userId);
    subjects = (data ?? []).map((l) => ({
      id: l.player_id,
      name: l.player.full_name || l.player.email,
    }));
  }
  const [{ data: docs }, { data: groups }, { data: responses }] = await Promise.all([
    supabase
      .from("team_documents")
      .select("*")
      .eq("org_id", orgId)
      .eq("audience", "families")
      .eq("archived", false)
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("player_group_members")
      .select("group_id, profile_id")
      .in(
        "profile_id",
        subjects.map((s) => s.id),
      ),
    subjects.length
      ? supabase
          .from("document_responses")
          .select("*")
          .in(
            "subject_id",
            subjects.map((s) => s.id),
          )
      : Promise.resolve({ data: [] as DocumentResponseRow[] }),
  ]);
  const inGroup = (doc: TeamDocumentRow, s: Person) =>
    !doc.group_id ||
    (groups ?? []).some((g) => g.group_id === doc.group_id && g.profile_id === s.id);
  const items = ((docs ?? []) as TeamDocumentRow[]).flatMap((doc) =>
    subjects
      .filter((s) => inGroup(doc, s))
      .map((s) => ({
        doc,
        subject: s,
        response:
          ((responses ?? []) as DocumentResponseRow[]).find(
            (r) => r.document_id === doc.id && r.subject_id === s.id,
          ) ?? null,
      })),
  );
  return { subjects, items, todo: items.filter((i) => !i.response && i.doc.kind !== "read") };
}
