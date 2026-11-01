"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/auth/actions";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { createOrganization } from "./actions";
import { TEAM_TYPES } from "@/constants/modules";
import { selectClass } from "@/components/ui/select";

export function CreateOrgForm() {
  const [state, action] = useActionState<FormState, FormData>(createOrganization, {});
  return (
    <form action={action} className="space-y-4">
      <Field
        label="Team or club name"
        name="name"
        placeholder="Riverside Rays 12U"
        autoComplete="organization"
        required
      />
      <div className="space-y-1.5">
        <label htmlFor="team_type" className="block text-sm font-medium text-zinc-800">
          What kind of team is it?
        </label>
        <select id="team_type" name="team_type" defaultValue="" className={`${selectClass} w-full`}>
          <option value="">Choose one…</option>
          {TEAM_TYPES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-zinc-500">
          We&apos;ll turn on the features that fit. You can change them later in Settings.
        </p>
      </div>
      <FormMessage state={state} />
      <SubmitButton className="w-full" pendingLabel="Creating…">
        Create team
      </SubmitButton>
    </form>
  );
}
