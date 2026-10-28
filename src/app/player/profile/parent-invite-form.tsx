"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/auth/actions";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { inviteMyParent } from "./actions";

export function ParentInviteForm() {
  const [state, action] = useActionState<FormState, FormData>(inviteMyParent, {});
  return (
    <form action={action} className="space-y-3">
      <Field
        label="Parent or guardian email"
        name="email"
        type="email"
        placeholder="parent@example.com"
        autoComplete="off"
        defaultValue={state.values?.email}
        required
      />
      <FormMessage state={state} />
      <SubmitButton className="w-full" pendingLabel="Creating invite…">
        Create invite link
      </SubmitButton>
    </form>
  );
}
