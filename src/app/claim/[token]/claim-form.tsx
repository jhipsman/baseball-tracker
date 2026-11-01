"use client";

import { useActionState } from "react";
import { claimAccount } from "@/lib/claim-actions";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function ClaimForm({ token, email }: { token: string; email: string }) {
  const [state, action] = useActionState(claimAccount, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <p className="text-sm text-zinc-600">
        You&apos;ll sign in with <strong className="text-zinc-900">{email}</strong>.
      </p>
      <Field
        label="Choose a password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
      />
      {state?.error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      <SubmitButton className="w-full">Set up my account</SubmitButton>
    </form>
  );
}
