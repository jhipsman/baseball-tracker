"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, type FormState } from "@/lib/auth/actions";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";

export function LoginForm({
  next,
  variant = "primary",
}: {
  next?: string;
  /** "secondary" when signing in is the alternative to creating an account. */
  variant?: "primary" | "secondary";
}) {
  const [state, action] = useActionState<FormState, FormData>(login, {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? "/"} />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        required
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <p className="-mt-2 text-right text-sm">
        <Link href="/forgot-password" className="font-medium text-brand-700 hover:underline">
          Forgot password?
        </Link>
      </p>
      <FormMessage state={state} />
      <SubmitButton className="w-full" variant={variant} pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}
