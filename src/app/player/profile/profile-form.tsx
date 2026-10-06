"use client";

import type { FormState } from "@/lib/auth/actions";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFormAction } from "@/components/ui/use-form-action";
import { updateProfile } from "./actions";

export function ProfileForm({ fullName }: { fullName: string }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(updateProfile, {});
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field label="Name" name="full_name" defaultValue={fullName} autoComplete="name" required />
      <FormMessage state={state} />
      <SubmitButton pending={pending} className="w-full" pendingLabel="Saving…">
        Save
      </SubmitButton>
    </form>
  );
}
