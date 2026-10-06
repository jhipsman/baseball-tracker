"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/auth/actions";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SelectField } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { INVITABLE_ROLES, ROLE_LABELS } from "@/constants";
import { inviteMember } from "./actions";

export function InviteForm() {
  const [state, action] = useActionState<FormState, FormData>(inviteMember, {});

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
        <Field
          label="Email"
          name="email"
          type="email"
          placeholder="player@example.com"
          defaultValue={state.values?.email}
          required
        />
        <SelectField label="Role" name="role" defaultValue={state.values?.role ?? "player"}>
          {INVITABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </SelectField>
        <SubmitButton pendingLabel="Inviting…">Invite</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
