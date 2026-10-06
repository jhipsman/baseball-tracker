"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/lib/auth/actions";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SelectField } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { createProgram } from "../actions";
import { ProgramFields } from "../program-fields";

export function NewProgramForm({ templates }: { templates: { id: string; name: string }[] }) {
  const [state, action] = useActionState<FormState, FormData>(createProgram, {});
  const [templateId, setTemplateId] = useState(state.values?.template_id ?? "");
  const v = state.values ?? {};

  return (
    <form action={action} className="space-y-5 rounded-xl bg-white p-5 ring-1 ring-zinc-200">
      {templates.length > 0 ? (
        <SelectField
          label="Start from"
          name="template_id"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
        >
          <option value="">Blank program</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              Template: {t.name}
            </option>
          ))}
        </SelectField>
      ) : null}

      <ProgramFields
        defaults={{
          name: v.name,
          description: v.description,
          program_type: v.program_type,
          season_phase: v.season_phase,
          is_template: v.is_template === "on",
        }}
      />

      {templateId ? null : (
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Weeks"
            name="weeks"
            type="number"
            min={1}
            max={52}
            defaultValue={v.weeks ?? "4"}
          />
          <Field
            label="Days per week"
            name="days_per_week"
            type="number"
            min={1}
            max={7}
            defaultValue={v.days_per_week ?? "3"}
          />
        </div>
      )}

      <FormMessage state={state} />
      <SubmitButton pendingLabel="Creating…">Create &amp; open builder</SubmitButton>
    </form>
  );
}
