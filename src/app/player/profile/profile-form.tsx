"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/auth/actions";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateProfile } from "./actions";

export function ProfileForm({ fullName }: { fullName: string }) {
  const [state, action] = useActionState<FormState, FormData>(updateProfile, {});
  return (
    <form action={action} className="space-y-3">
      <Field label="Name" name="full_name" defaultValue={fullName} autoComplete="name" required />
      <FormMessage state={state} />
      <SubmitButton className="w-full" pendingLabel="Saving…">
        Save
      </SubmitButton>
    </form>
  );
}
