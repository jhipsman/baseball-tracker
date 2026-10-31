"use client";

import { useState, useTransition } from "react";
import { saveEmergencyPlan, saveMedicalCard } from "@/lib/medical-actions";
import type { Contact } from "@/lib/medical";

const input = "mt-1 block w-full rounded-lg bg-surface px-3 ring-1 ring-zinc-300";

/** Families keep the game-day medical card current. */
export function MedicalForm({
  playerId,
  firstName,
  initial,
}: {
  playerId: string;
  firstName: string;
  initial: {
    allergies: string;
    medications: string;
    conditions: string;
    contacts: Contact[];
  };
}) {
  const [allergies, setAllergies] = useState(initial.allergies);
  const [medications, setMedications] = useState(initial.medications);
  const [conditions, setConditions] = useState(initial.conditions);
  const [contacts, setContacts] = useState<Contact[]>(
    initial.contacts.length
      ? [...initial.contacts, ...Array(Math.max(0, 2 - initial.contacts.length)).fill(null)].map(
          (c) => c ?? { name: "", phone: "", relation: "" },
        )
      : [
          { name: "", phone: "", relation: "Parent / guardian" },
          { name: "", phone: "", relation: "" },
        ],
  );
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (i: number, k: keyof Contact, v: string) =>
    setContacts((cs) => cs.map((c, j) => (j === i ? { ...c, [k]: v } : c)));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setMessage(null);
        start(async () => {
          const res = await saveMedicalCard(playerId, {
            allergies,
            medications,
            conditions,
            contacts,
          });
          setMessage(
            res.error
              ? { ok: false, text: res.error }
              : { ok: true, text: "Saved. Coaches see it." },
          );
        });
      }}
    >
      <label className="block text-sm font-medium">
        Allergies
        <input
          value={allergies}
          onChange={(e) => setAllergies(e.target.value)}
          maxLength={300}
          placeholder="e.g. Peanuts (carries an EpiPen), bee stings. Or “None”."
          className={`${input} h-11`}
        />
      </label>
      <label className="block text-sm font-medium">
        Medications
        <input
          value={medications}
          onChange={(e) => setMedications(e.target.value)}
          maxLength={300}
          placeholder="e.g. Albuterol inhaler in bat bag"
          className={`${input} h-11`}
        />
      </label>
      <label className="block text-sm font-medium">
        Conditions the coaches should know about
        <textarea
          value={conditions}
          onChange={(e) => setConditions(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="e.g. Asthma, diabetes, past concussion"
          className={`${input} py-2`}
        />
      </label>
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Emergency contacts</legend>
        {contacts.map((c, i) => (
          <div key={i} className="grid gap-2 rounded-xl bg-zinc-50 p-3 sm:grid-cols-3">
            <label className="text-xs font-medium text-zinc-700">
              Name
              <input
                value={c.name}
                onChange={(e) => set(i, "name", e.target.value)}
                maxLength={80}
                autoComplete="off"
                className={`${input} h-11 text-sm`}
              />
            </label>
            <label className="text-xs font-medium text-zinc-700">
              Phone
              <input
                type="tel"
                value={c.phone}
                onChange={(e) => set(i, "phone", e.target.value)}
                maxLength={30}
                className={`${input} h-11 text-sm`}
              />
            </label>
            <label className="text-xs font-medium text-zinc-700">
              Relation to {firstName}
              <input
                value={c.relation}
                onChange={(e) => set(i, "relation", e.target.value)}
                maxLength={40}
                className={`${input} h-11 text-sm`}
              />
            </label>
          </div>
        ))}
        {contacts.length < 3 ? (
          <button
            type="button"
            onClick={() => setContacts((cs) => [...cs, { name: "", phone: "", relation: "" }])}
            className="min-h-11 text-sm font-semibold text-brand-700"
          >
            + Add a contact
          </button>
        ) : null}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="h-11 rounded-full bg-brand-700 px-5 text-sm font-semibold text-on-brand disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save medical card"}
        </button>
        {message ? (
          <span
            role="status"
            className={message.ok ? "text-sm text-brand-800" : "text-sm text-red-700"}
          >
            {message.text}
          </span>
        ) : null}
      </div>
    </form>
  );
}

/** Admins edit the field emergency plan; everyone on staff reads it. */
export function EmergencyPlanForm({ initial }: { initial: string }) {
  const [plan, setPlan] = useState(initial);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      className="space-y-2 print:hidden"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveEmergencyPlan(plan);
          setMessage(res.error ? { ok: false, text: res.error } : { ok: true, text: "Saved." });
        });
      }}
    >
      <label className="block text-sm font-medium">
        Edit the plan
        <textarea
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          maxLength={1000}
          rows={4}
          placeholder={
            "Nearest ER: Mercy Hospital, 123 Main St (8 min)\nAED: concession stand, by the door\nCoach Lee calls 911; Coach Sam meets the ambulance at the lot gate"
          }
          className={`${input} py-2 text-sm`}
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || plan === initial}
          className="h-11 rounded-full bg-zinc-900 px-5 text-sm font-semibold text-zinc-50 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save plan"}
        </button>
        {message ? (
          <span
            role="status"
            className={message.ok ? "text-sm text-brand-800" : "text-sm text-red-700"}
          >
            {message.text}
          </span>
        ) : null}
      </div>
    </form>
  );
}
