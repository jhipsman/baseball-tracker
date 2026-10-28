"use client";

import { useState, useTransition } from "react";
import type { FormState } from "@/lib/auth/actions";
import {
  createPractice,
  deletePractice,
  duplicatePractice,
  setPracticePublished,
  updatePracticeDetails,
} from "@/lib/practice-actions";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SelectField } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFormAction } from "@/components/ui/use-form-action";
import { cn } from "@/lib/utils";

export type Group = { id: string; name: string };
export type PracticeDefaults = {
  title?: string;
  date?: string | null;
  startTime?: string | null;
  location?: string | null;
  groupId?: string | null;
  notes?: string | null;
};

const textareaClass =
  "block w-full rounded-lg border-0 bg-white px-3 py-2 text-base text-zinc-900 ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-brand-600 sm:text-sm";

/** Title / date / time / location / group / notes inputs. */
export function PracticeFields({
  defaults,
  groups,
  template,
}: {
  defaults: PracticeDefaults;
  groups: Group[];
  template: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field
        label="Title"
        name="title"
        required
        maxLength={120}
        defaultValue={defaults.title ?? ""}
        placeholder="e.g. Tuesday practice"
        className="sm:col-span-2"
      />
      {template ? null : (
        <Field label="Date" name="date" type="date" required defaultValue={defaults.date ?? ""} />
      )}
      <Field
        label="Start time"
        name="start_time"
        type="time"
        defaultValue={defaults.startTime?.slice(0, 5) ?? ""}
      />
      <Field
        label="Location"
        name="location"
        maxLength={200}
        defaultValue={defaults.location ?? ""}
        placeholder="e.g. Main field"
        className={template ? "" : "sm:col-span-2"}
      />
      <SelectField
        label="Who"
        name="group_id"
        defaultValue={defaults.groupId ?? ""}
        className="sm:col-span-2"
      >
        <option value="">Whole team</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name} only
          </option>
        ))}
      </SelectField>
      <label className="block space-y-1.5 sm:col-span-2">
        <span className="block text-sm font-medium text-zinc-800">Coach notes</span>
        <textarea
          name="notes"
          rows={3}
          maxLength={4000}
          defaultValue={defaults.notes ?? ""}
          placeholder="Uniform, what to bring, focus for the day…"
          className={textareaClass}
        />
      </label>
    </div>
  );
}

export function NewPracticeForm({
  groups,
  templates,
  today,
  initialTemplate,
  asTemplate,
}: {
  groups: Group[];
  templates: { id: string; title: string; summary: string }[];
  today: string;
  initialTemplate?: string;
  asTemplate: boolean;
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(createPractice, {});
  const [templateId, setTemplateId] = useState(initialTemplate ?? "");
  const picked = templates.find((t) => t.id === templateId);
  const v = state.values;
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="is_template" value={String(asTemplate)} />
      {templates.length > 0 && !asTemplate ? (
        <SelectField
          label="Start from"
          name="template_id"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
        >
          <option value="">Blank practice</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              Template: {t.title} ({t.summary})
            </option>
          ))}
        </SelectField>
      ) : null}
      <PracticeFields
        key={templateId}
        template={asTemplate}
        groups={groups}
        defaults={{
          title: v?.title ?? picked?.title ?? "",
          date: v?.date ?? today,
          startTime: v?.start_time,
          location: v?.location,
          groupId: v?.group_id,
          notes: v?.notes,
        }}
      />
      <FormMessage state={state} />
      <SubmitButton pending={pending} pendingLabel="Creating…">
        {asTemplate ? "Create template" : "Create practice"}
      </SubmitButton>
    </form>
  );
}

export function PracticeDetailsForm({
  id,
  template,
  defaults,
  groups,
}: {
  id: string;
  template: boolean;
  defaults: PracticeDefaults;
  groups: Group[];
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(updatePracticeDetails, {});
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="is_template" value={String(template)} />
      <PracticeFields defaults={defaults} groups={groups} template={template} />
      <FormMessage state={state} />
      <SubmitButton pending={pending} pendingLabel="Saving…" variant="secondary">
        Save details
      </SubmitButton>
    </form>
  );
}

/** Publish-to-team switch. Publishing notifies players & parents. */
export function PublishToggle({
  planId,
  published,
  audience,
}: {
  planId: string;
  published: boolean;
  audience: string;
}) {
  const [on, setOn] = useState(published);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toggle = () => {
    const next = !on;
    if (next && !confirm(`Publish to ${audience}? Players and parents will be notified.`)) return;
    setError(null);
    setOn(next);
    start(async () => {
      const r = await setPracticePublished(planId, next);
      if (r.error) {
        setOn(!next);
        setError(r.error);
      }
    });
  };
  return (
    <div
      className={cn(
        "rounded-xl p-4 ring-1",
        on ? "bg-brand-50 ring-brand-200" : "bg-white ring-zinc-200",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">{on ? "Published" : "Draft"}</p>
          <p className="text-xs text-zinc-600">
            {on
              ? `Visible to ${audience}.`
              : `Only staff can see this. Publishing shows it to ${audience} and sends them a notification.`}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Publish to team"
          onClick={toggle}
          disabled={pending}
          className={cn(
            "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60",
            on ? "bg-brand-700" : "bg-zinc-300",
          )}
        >
          <span
            className={cn(
              "inline-block size-5 rounded-full bg-white shadow transition-transform",
              on ? "translate-x-6" : "translate-x-1",
            )}
          />
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

export function DuplicateForm({
  id,
  defaultDate,
  label = "Duplicate to date",
}: {
  id: string;
  defaultDate: string;
  label?: string;
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(duplicatePractice, {});
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <div className="flex items-end gap-2">
        <Field
          label={label}
          id={`dup-date-${id}`}
          name="date"
          type="date"
          required
          defaultValue={defaultDate}
        />
        <SubmitButton pending={pending} pendingLabel="Copying…" variant="secondary">
          {label.startsWith("Use") ? "Create" : "Duplicate"}
        </SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function SaveAsTemplateButton({ id }: { id: string }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(duplicatePractice, {});
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="as_template" value="true" />
      <SubmitButton pending={pending} pendingLabel="Saving…" variant="secondary" className="w-full">
        Save as template
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function DeletePracticeButton({ id, template }: { id: string; template: boolean }) {
  return (
    <form
      action={deletePractice}
      onSubmit={(e) => {
        if (!confirm(`Delete this ${template ? "template" : "practice"}? This can't be undone.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <SubmitButton pendingLabel="Deleting…" variant="ghost" className="w-full text-red-700">
        Delete {template ? "template" : "practice"}
      </SubmitButton>
    </form>
  );
}
