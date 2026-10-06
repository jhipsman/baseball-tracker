"use client";

import { useActionState } from "react";
import { requestPasswordReset, type FormState } from "@/lib/auth/actions";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";

export function ForgotPasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(requestPasswordReset, {});
  return (
    <form action={action} className="space-y-4">
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        required
      />
      <FormMessage state={state} />
      <SubmitButton className="w-full" pendingLabel="Sending…">
        Send reset link
      </SubmitButton>
    </form>
  );
}
