"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { submitRegistration, type RegistrationInput } from "@/lib/registration-actions";
import { money } from "@/lib/team-payments";
import { PLAYER_POSITIONS } from "@/constants";
import { cn } from "@/lib/utils";

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-2xl bg-surface p-4 ring-1 ring-zinc-200 sm:p-5">
      <legend className="sr-only">{title}</legend>
      <div className="flex items-center gap-3" aria-hidden>
        <span className="grid size-8 place-items-center rounded-full bg-zinc-900 text-sm font-bold text-zinc-50">
          {n}
        </span>
        <h2 className="font-semibold">{title}</h2>
      </div>
      {children}
    </fieldset>
  );
}

/** The family's side of registration: who, who to call, the waiver, and how to pay. */
export function JoinForm({
  token,
  feeCents,
  installmentsMax,
  waiver,
  defaultParentName,
}: {
  token: string;
  feeCents: number;
  installmentsMax: number;
  waiver: string;
  defaultParentName: string;
}) {
  const router = useRouter();
  const [plan, setPlan] = useState(1);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const options = feeCents
    ? [1, ...[2, 3, 4, 5, 6, 8, 10, 12].filter((n) => n <= installmentsMax)]
    : [];

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const data = Object.fromEntries(
          [
            "parent_name",
            "parent_phone",
            "player_name",
            "player_birth_date",
            "player_email",
            "player_position",
            "emergency_name",
            "emergency_phone",
            "emergency_relation",
            "medical_notes",
            "waiver_signed_name",
          ].map((k) => [k, String(fd.get(k) ?? "")]),
        ) as RegistrationInput;
        setError("");
        start(async () => {
          const res = await submitRegistration(token, data, plan, agreed);
          if (res.error) setError(res.error);
          else router.push(feeCents ? "/payments?registered=1" : `/join/${token}?done=1`);
        });
      }}
    >
      <Section n={1} title="You (parent or guardian)">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Your name"
            name="parent_name"
            required
            maxLength={120}
            autoComplete="name"
            defaultValue={defaultParentName}
          />
          <Field
            label="Mobile phone"
            name="parent_phone"
            type="tel"
            required
            minLength={7}
            maxLength={30}
            autoComplete="tel"
          />
        </div>
      </Section>

      <Section n={2} title="The player">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Player's name" name="player_name" required maxLength={120} />
          <Field label="Birthdate" name="player_birth_date" type="date" required />
          <SelectField label="Main position" name="player_position" defaultValue="">
            <option value="">Not sure</option>
            {PLAYER_POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </SelectField>
          <Field
            label="Player's email (optional)"
            name="player_email"
            type="email"
            maxLength={254}
            hint="13 and older: they get their own login for workouts and stats."
          />
        </div>
      </Section>

      <Section n={3} title="Emergency and medical">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Emergency contact" name="emergency_name" required maxLength={120} />
          <Field
            label="Their phone"
            name="emergency_phone"
            type="tel"
            required
            minLength={7}
            maxLength={30}
          />
          <Field
            label="Relationship"
            name="emergency_relation"
            maxLength={60}
            placeholder="Grandparent"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="medical_notes" className="block text-sm font-medium text-zinc-800">
            Allergies, conditions or medications coaches should know about
          </label>
          <textarea
            id="medical_notes"
            name="medical_notes"
            maxLength={2000}
            rows={3}
            placeholder="None"
            className="block w-full rounded-lg bg-surface px-3 py-2 text-sm ring-1 ring-zinc-300 ring-inset"
          />
        </div>
      </Section>

      <Section n={4} title="Waiver">
        <div
          tabIndex={0}
          aria-label="Waiver text"
          className="max-h-56 overflow-y-auto rounded-lg bg-zinc-50 p-3 text-sm whitespace-pre-line text-zinc-800 ring-1 ring-zinc-200"
        >
          {waiver}
        </div>
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-brand-700"
          />
          I&apos;ve read the waiver and agree to it for myself and my player.
        </label>
        <Field
          label="Type your full name to sign"
          name="waiver_signed_name"
          required
          minLength={2}
          maxLength={120}
        />
      </Section>

      {feeCents ? (
        <Section n={5} title="Payment">
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="How to pay">
            {options.map((n) => (
              <label
                key={n}
                className={cn(
                  "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 ring-1",
                  plan === n
                    ? "bg-brand-50 ring-2 ring-brand-600"
                    : "bg-surface ring-zinc-200 hover:bg-zinc-50",
                )}
              >
                <input
                  type="radio"
                  name="plan"
                  checked={plan === n}
                  onChange={() => setPlan(n)}
                  className="size-5 accent-brand-700"
                />
                <span>
                  <span className="block font-semibold">
                    {n === 1 ? `Pay ${money(feeCents)} now` : `${n} monthly payments`}
                  </span>
                  <span className="block text-sm text-zinc-600">
                    {n === 1 ? "One payment" : `${money(Math.ceil(feeCents / n))} a month`}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <p className="text-sm text-zinc-600">
            Next you&apos;ll see your balance and can pay by card or bank account.
          </p>
        </Section>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending || !agreed} className="h-14 w-full text-base">
        {pending ? "Registering…" : feeCents ? "Register and continue to payment" : "Register"}
      </Button>
      {!agreed ? (
        <p className="text-center text-sm text-zinc-500">Agree to the waiver to register.</p>
      ) : null}
    </form>
  );
}
