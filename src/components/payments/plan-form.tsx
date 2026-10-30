"use client";
import { useState } from "react";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import { useFormAction } from "@/components/ui/use-form-action";
import { createPaymentPlan } from "@/lib/team-payment-actions";
import { readCents, installmentDates, money } from "@/lib/team-payments";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/auth/actions";
export function PaymentPlanForm({
  members,
  today,
  requestId,
}: {
  members: { id: string; name: string; role: string }[];
  today: string;
  requestId: string;
}) {
  const { state, onSubmit, pending } = useFormAction<FormState & { createdId?: string }>(
    createPaymentPlan,
    {},
  );
  const [seenCreated, setSeenCreated] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState(requestId);
  const [amount, setAmount] = useState("");
  const [count, setCount] = useState(6);
  const [first, setFirst] = useState(today);
  const cents = readCents(amount),
    dates = installmentDates(first, count);
  if (state.createdId && state.createdId !== seenCreated)
    return (
      <div className="space-y-4">
        <FormMessage state={state} />
        <Button
          variant="secondary"
          onClick={() => {
            setSeenCreated(state.createdId!);
            setRequestKey(crypto.randomUUID());
            setAmount("");
            setCount(6);
            setFirst(today);
          }}
        >
          Create another plan
        </Button>
      </div>
    );
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input name="request_id" type="hidden" value={requestKey} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Plan title"
          name="title"
          required
          maxLength={120}
          placeholder="Spring team dues"
        />
        <Field label="Season" name="season" required maxLength={80} placeholder="2027 Spring" />
        <SelectField label="Who pays" name="payer_id" required defaultValue="">
          <option value="">Choose a family member or player</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} · {m.role}
            </option>
          ))}
        </SelectField>
        <SelectField label="Player (optional)" name="player_id" defaultValue="">
          <option value="">Not assigned to one player</option>
          {members
            .filter((m) => m.role === "player")
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
        </SelectField>
        <Field
          label="Each installment ($)"
          name="amount"
          inputMode="decimal"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="100.00"
        />
        <Field
          label="Monthly installments"
          name="count"
          type="number"
          min={1}
          max={24}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          required
        />
        <Field
          label="First due date"
          name="first_due"
          type="date"
          value={first}
          onChange={(e) => setFirst(e.target.value)}
          required
        />
      </div>
      {cents && dates.length > 0 && (
        <section
          aria-label="Installment preview"
          className="space-y-2 rounded-lg bg-zinc-50 p-4 text-sm"
        >
          <p className="font-semibold">
            {count} × {money(cents)} = {money(count * cents)} total
          </p>
          <p className="text-zinc-600">Monthly due dates: {dates.join(" · ")}</p>
          <p className="text-zinc-600">
            No charge is made when you create this plan. The payer chooses how to pay or enrolls in
            autopay after online payment setup.
          </p>
        </section>
      )}
      <FormMessage state={state} />
      <SubmitButton pending={pending} pendingLabel="Creating…">
        Create installment plan
      </SubmitButton>
    </form>
  );
}
