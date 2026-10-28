"use client";

import { useEffect, useRef } from "react";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import { useFormAction } from "@/components/ui/use-form-action";
import { postAnnouncement, type MessageFormState } from "@/lib/message-actions";
import { textareaClass } from "./styles";

export function AnnouncementForm({ groups }: { groups: { id: string; name: string }[] }) {
  const form = useRef<HTMLFormElement>(null);
  const { state, onSubmit, pending } = useFormAction<MessageFormState>(postAnnouncement, {});
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state.ok]);

  return (
    <form ref={form} onSubmit={onSubmit} className="space-y-4">
      <Field
        label="Title"
        name="title"
        required
        maxLength={140}
        placeholder="Practice moved to 5pm"
      />
      <div className="space-y-1.5">
        <label htmlFor="announcement-body" className="block text-sm font-medium text-zinc-800">
          Message
        </label>
        <textarea
          id="announcement-body"
          name="body"
          required
          maxLength={5000}
          rows={4}
          className={textareaClass}
        />
      </div>
      <SelectField label="Who sees it" name="audience" defaultValue="team">
        <option value="team">Whole team</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name} only
          </option>
        ))}
      </SelectField>
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm text-zinc-800">
          <input
            type="checkbox"
            name="include_parents"
            defaultChecked
            className="size-4 accent-brand-700"
          />
          Also send to parents
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-800">
          <input type="checkbox" name="pinned" className="size-4 accent-brand-700" />
          Pin to the top
        </label>
      </div>
      <FormMessage state={state} />
      <SubmitButton pending={pending} pendingLabel="Posting…" className="w-full">
        Post announcement
      </SubmitButton>
    </form>
  );
}
