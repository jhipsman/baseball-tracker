"use client";

import { useActionState } from "react";
import { updatePassword, type FormState } from "@/lib/auth/actions";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";

export function ResetPasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(updatePassword, {});
  return (
    <form action={action} className="space-y-4">
      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        hint="At least 8 characters."
        required
      />
      <Field
        label="Confirm new password"
        name="confirm"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
      />
      <FormMessage state={state} />
      <SubmitButton className="w-full" pendingLabel="Saving…">
        Save password
      </SubmitButton>
    </form>
  );
}
