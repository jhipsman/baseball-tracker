import type { Metadata } from "next";
import { requireActiveOrg } from "@/lib/org";
import { siteOrigin } from "@/lib/site";
import { CopyButton } from "@/components/ui/copy-button";
import { selectClass } from "@/components/ui/select";
import { ORG_ROLES, PLAYER_POSITIONS, ROLE_LABELS } from "@/constants";
import { cn } from "@/lib/utils";
import { InviteForm } from "./invite-form";
import { CreateGroupForm } from "./group-form";
import {
  deleteGroup,
  removeMember,
  revokeInvitation,
  setGroupMembers,
  updateMember,
} from "./actions";

export const metadata: Metadata = { title: "Roster" };

export default async function RosterPage() {
  const { supabase, org, membership, user, isStaff } = await requireActiveOrg();
  const isAdmin = membership.role === "admin";

  const [{ data: members, error }, invitations] = await Promise.all([
    supabase
      .from("org_memberships")
      .select(
        "id, role, status, position, jersey_number, profile_id, profile:profiles (full_name, email)",
      )
      .eq("org_id", org.id)
      .order("role")
      .order("created_at"),
    isAdmin
      ? supabase
          .from("org_invitations")
          .select("id, email, role, token, expires_at")
          .eq("org_id", org.id)
          .is("accepted_at", null)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);
  if (error) throw error;

  const { data: orgRow } = await supabase
    .from("organizations")
    .select("owner_id")
    .eq("id", org.id)
    .single();
  const origin = await siteOrigin();
  const { data: groups } = await supabase
    .from("player_groups")
    .select("id, name, player_group_members (profile_id)")
    .eq("org_id", org.id)
    .order("name");
  const players = members.filter((m) => m.role === "player");
  const nameOf = new Map(
    members.map((m) => [m.profile_id, m.profile.full_name || m.profile.email]),
  );
  const pending = invitations.data ?? [];

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Roster</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {members.length} member{members.length === 1 ? "" : "s"} in {org.name}
        </p>
      </div>

      {isAdmin ? (
        <section className="rounded-xl bg-white p-5 ring-1 ring-zinc-200">
          <h2 className="font-semibold">Invite someone</h2>
          <p className="mt-1 mb-4 text-sm text-zinc-600">
            They&apos;ll join once they sign in with this email and open the invite link. Pending
            invitations also appear for them right after sign-up.
          </p>
          <InviteForm />

          {pending.length > 0 ? (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-zinc-700">Pending invitations</h3>
              <ul className="mt-2 divide-y divide-zinc-100">
                {pending.map((inv) => {
                  const expired = new Date(inv.expires_at) < new Date();
                  return (
                    <li key={inv.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                      <span className="min-w-0 flex-1 truncate">{inv.email}</span>
                      <span className="text-zinc-500">{ROLE_LABELS[inv.role]}</span>
                      {expired ? (
                        <span className="text-xs font-medium text-red-600">Expired</span>
                      ) : (
                        <CopyButton value={`${origin}/invite/${inv.token}`} />
                      )}
                      <form action={revokeInvitation}>
                        <input type="hidden" name="id" value={inv.id} />
                        <button
                          type="submit"
                          className="text-xs font-semibold text-zinc-500 hover:text-red-600"
                        >
                          Revoke
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {isStaff ? (
        <section className="rounded-xl bg-white p-5 ring-1 ring-zinc-200">
          <h2 className="font-semibold">Groups</h2>
          <p className="mt-1 mb-4 text-sm text-zinc-600">
            Save sets of players (Pitchers, JV…) to assign programs and filter the calendar in one
            click.
          </p>
          <CreateGroupForm />
          {groups && groups.length > 0 ? (
            <ul className="mt-4 divide-y divide-zinc-100">
              {groups.map((g) => {
                const memberIds = new Set(g.player_group_members.map((m) => m.profile_id));
                return (
                  <li key={g.id} className="py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{g.name}</span>
                      <span className="text-sm text-zinc-500">
                        {memberIds.size} player{memberIds.size === 1 ? "" : "s"}
                      </span>
                      <form action={deleteGroup} className="ml-auto">
                        <input type="hidden" name="id" value={g.id} />
                        <button
                          type="submit"
                          className="text-xs font-semibold text-zinc-400 hover:text-red-600"
                        >
                          Delete group
                        </button>
                      </form>
                    </div>
                    {memberIds.size > 0 ? (
                      <p className="mt-1 text-sm text-zinc-600">
                        {[...memberIds].map((id) => nameOf.get(id) ?? "Player").join(", ")}
                      </p>
                    ) : null}
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-semibold text-brand-700">
                        Edit players
                      </summary>
                      {players.length === 0 ? (
                        <p className="mt-2 text-sm text-zinc-500">No players on the roster yet.</p>
                      ) : (
                        <form
                          key={[...memberIds].sort().join(",")}
                          action={setGroupMembers}
                          className="mt-2 space-y-2"
                        >
                          <input type="hidden" name="group_id" value={g.id} />
                          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                            {players.map((p) => (
                              <label
                                key={p.profile_id}
                                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ring-1 ring-inset ring-zinc-200 has-checked:bg-brand-50 has-checked:ring-brand-600"
                              >
                                <input
                                  type="checkbox"
                                  name="player_id"
                                  value={p.profile_id}
                                  defaultChecked={memberIds.has(p.profile_id)}
                                  className="size-4 accent-brand-700"
                                />
                                <span className="truncate">
                                  {nameOf.get(p.profile_id)}
                                  {p.position ? (
                                    <span className="ml-1 text-zinc-500">{p.position}</span>
                                  ) : null}
                                </span>
                              </label>
                            ))}
                          </div>
                          <button
                            type="submit"
                            className="h-9 rounded-lg bg-brand-700 px-3 text-sm font-semibold text-white hover:bg-brand-600"
                          >
                            Save players
                          </button>
                        </form>
                      )}
                    </details>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl bg-white ring-1 ring-zinc-200">
        <ul className="divide-y divide-zinc-100">
          {members.map((m) => {
            const isOwner = m.profile_id === orgRow?.owner_id;
            const isSelf = m.profile_id === user.id;
            const name = m.profile.full_name || m.profile.email;
            return (
              <li key={m.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {m.jersey_number != null ? (
                      <span className="mr-2 text-zinc-400 tabular-nums">#{m.jersey_number}</span>
                    ) : null}
                    {name}
                    {isOwner ? (
                      <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600">
                        Owner
                      </span>
                    ) : null}
                    {isSelf ? <span className="ml-2 text-xs text-zinc-400">(you)</span> : null}
                  </p>
                  <p className="truncate text-sm text-zinc-500">{m.profile.email}</p>
                </div>

                {isAdmin && !isOwner ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <form
                      // Remount with fresh defaults after a save; React resets forms after an action.
                      key={`${m.role}-${m.position}-${m.jersey_number}`}
                      action={updateMember}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <input type="hidden" name="id" value={m.id} />
                      <select
                        name="role"
                        defaultValue={m.role}
                        aria-label="Role"
                        className={cn(selectClass, "h-9")}
                      >
                        {ORG_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                      <select
                        name="position"
                        defaultValue={m.position ?? ""}
                        aria-label="Position (players)"
                        className={cn(selectClass, "h-9")}
                      >
                        <option value="">Pos.</option>
                        {PLAYER_POSITIONS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                      <input
                        name="jersey_number"
                        defaultValue={m.jersey_number ?? ""}
                        inputMode="numeric"
                        maxLength={2}
                        placeholder="#"
                        aria-label="Jersey number (players)"
                        className={cn(selectClass, "h-9 w-14")}
                      />
                      <button
                        type="submit"
                        className="h-9 rounded-lg px-3 text-sm font-semibold ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50"
                      >
                        Save
                      </button>
                    </form>
                    <form action={removeMember}>
                      <input type="hidden" name="id" value={m.id} />
                      <button
                        type="submit"
                        className="h-9 px-2 text-sm font-semibold text-zinc-500 hover:text-red-600"
                      >
                        Remove
                      </button>
                    </form>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-600">
                    {ROLE_LABELS[m.role]}
                    {m.position ? ` · ${m.position}` : ""}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
