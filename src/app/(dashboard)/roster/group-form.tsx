"use client";

import type { FormState } from "@/lib/auth/actions";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFormAction } from "@/components/ui/use-form-action";
import { createGroup } from "./actions";

export function CreateGroupForm() {
  const { state, onSubmit, pending } = useFormAction<FormState>(createGroup, {});
  return (
    <form
      // Clear the name only after a successful create.
      key={state.message ?? "new"}
      onSubmit={onSubmit}
      className="space-y-2"
    >
      <div className="flex gap-2">
        <label htmlFor="group-name" className="sr-only">
          New group name
        </label>
        <input
          id="group-name"
          name="name"
          placeholder="e.g. Pitchers, JV, Catchers"
          maxLength={60}
          required
          className="block h-11 min-w-0 flex-1 rounded-lg border-0 bg-white px-3 text-base ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-brand-600 sm:text-sm"
        />
        <SubmitButton pending={pending} pendingLabel="Creating…">
          Create group
        </SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
