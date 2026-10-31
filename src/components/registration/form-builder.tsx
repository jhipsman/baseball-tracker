"use client";

import { useState } from "react";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import { useFormAction } from "@/components/ui/use-form-action";
import { createRegistrationForm } from "@/lib/registration-actions";
import { money, readCents } from "@/lib/team-payments";
import type { FormState } from "@/lib/auth/actions";

/** New season registration: what it costs, how families can pay, and the waiver they sign. */
export function RegistrationFormBuilder({ waiver }: { waiver: string }) {
  const { state, onSubmit, pending } = useFormAction<FormState & { id?: string }>(
    createRegistrationForm,
    {},
  );
  const [fee, setFee] = useState("");
  const [count, setCount] = useState(1);
  const cents = readCents(fee) ?? 0;
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" name="title" required maxLength={120} placeholder="Spring 2027 · 14U" />
        <Field label="Season" name="season" required maxLength={80} placeholder="Spring 2027" />
        <Field
          label="Fee per player ($)"
          name="fee"
          inputMode="decimal"
          placeholder="0 for free"
          value={fee}
          onChange={(e) => setFee(e.target.value)}
        />
        <SelectField
          label="How families can pay"
          name="installments"
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          disabled={cents === 0}
        >
          <option value={1}>In full at sign-up</option>
          {[2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
            <option key={n} value={n}>
              In full, or up to {n} monthly payments
            </option>
          ))}
        </SelectField>
        <Field
          label="First payment due"
          name="first_due"
          type="date"
          hint="Leave blank to charge when they register."
        />
        <Field
          label="Spots"
          name="capacity"
          inputMode="numeric"
          placeholder="No limit"
          hint="Registration closes itself when it's full."
        />
      </div>
      {cents > 0 && count > 1 ? (
        <p className="text-sm text-zinc-600">
          Families choose: {money(cents)} at once, or {count} payments of{" "}
          {money(Math.ceil(cents / count))}.
        </p>
      ) : null}
      <div className="space-y-1.5">
        <label htmlFor="waiver" className="block text-sm font-medium text-zinc-800">
          Waiver families sign
        </label>
        <textarea
          id="waiver"
          name="waiver"
          defaultValue={waiver}
          rows={8}
          required
          className="block w-full rounded-lg bg-surface px-3 py-2 text-sm ring-1 ring-zinc-300 ring-inset"
        />
        <p className="text-xs text-zinc-500">
          A starting point, not legal advice. Have your league&apos;s or a local lawyer&apos;s
          wording if you have it.
        </p>
      </div>
      <FormMessage state={state} />
      <SubmitButton pending={pending}>Create registration link</SubmitButton>
    </form>
  );
}
