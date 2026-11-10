"use client";

import { deleteMyAccount, type FormState } from "@/lib/auth/actions";
import { Disclosure } from "@/components/ui/disclosure";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { useFormAction } from "@/components/ui/use-form-action";

export function DeleteAccountForm() {
  const { state, onSubmit, pending } = useFormAction<FormState>(deleteMyAccount, {});
  return (
    <Disclosure label="Delete my account…" openLabel="Keep my account">
      <form onSubmit={onSubmit} className="space-y-3">
        <Field
          label="Type DELETE to confirm"
          name="confirm"
          autoComplete="off"
          autoCapitalize="characters"
          required
        />
        <FormMessage state={state} />
        <button
          type="submit"
          disabled={pending}
          aria-disabled={pending}
          className="h-12 w-full rounded-xl text-sm font-semibold text-red-700 ring-1 ring-zinc-300 ring-inset disabled:opacity-60"
        >
          {pending ? "Deleting…" : "Delete my account for good"}
        </button>
      </form>
    </Disclosure>
  );
}
