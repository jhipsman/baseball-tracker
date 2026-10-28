"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/lib/auth/actions";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SelectField } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { ROLE_LABELS, type OrgRole } from "@/constants";
import { inviteMember } from "./actions";

/**
 * Invite someone to the team. Admins can pick any role; coaches and trainers
 * only see "Parent". Choosing Parent asks which player they follow.
 */
export function InviteForm({
  roles,
  players,
}: {
  roles: readonly OrgRole[];
  players: { id: string; name: string }[];
}) {
  const [state, action] = useActionState<FormState, FormData>(inviteMember, {});
  const [role, setRole] = useState<string>(roles[0] ?? "player");
  const isParent = role === "parent";

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem] sm:items-end">
        <Field
          label="Email"
          name="email"
          type="email"
          placeholder={isParent ? "parent@example.com" : "player@example.com"}
          defaultValue={state.values?.email}
          required
        />
        <SelectField
          label="Role"
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          {roles.map((r) => (
            <option key={r} value={r}>
              {r === "parent" ? "Parent / guardian" : ROLE_LABELS[r]}
            </option>
          ))}
        </SelectField>
      </div>
      {isParent ? (
        players.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Add players first; a parent invite is for a specific player.
          </p>
        ) : (
          <SelectField
            label="Parent of"
            name="player_id"
            defaultValue={state.values?.player_id ?? ""}
            required
          >
            <option value="" disabled>
              Choose a player…
            </option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SelectField>
        )
      ) : null}
      {isParent ? (
        <p className="text-xs text-zinc-500">
          Parents get a read-only view of their own player only: workouts, throwing, testing
          numbers, and reviewed videos.
        </p>
      ) : null}
      <SubmitButton pendingLabel="Inviting…">Invite</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

/** Invite a parent or guardian for one specific player. */
export function ParentInviteForm({ playerId }: { playerId: string }) {
  const [state, action] = useActionState<FormState, FormData>(inviteMember, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="role" value="parent" />
      <input type="hidden" name="player_id" value={playerId} />
      <div className="flex flex-wrap items-end gap-2">
        <Field
          label="Parent or guardian email"
          name="email"
          type="email"
          placeholder="parent@example.com"
          defaultValue={state.values?.email}
          className="min-w-56 flex-1"
          required
        />
        <SubmitButton pendingLabel="Inviting…">Invite parent</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
