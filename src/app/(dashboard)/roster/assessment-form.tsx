"use client";

import type { FormState } from "@/lib/auth/actions";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFormAction } from "@/components/ui/use-form-action";
import { METRICS } from "@/constants/metrics";
import { addAssessment } from "./assess-actions";

const GROUPS = [...new Set(METRICS.map((m) => m.group))];

export function AssessmentForm({ playerId, today }: { playerId: string; today: string }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(addAssessment, {});
  return (
    // Reset to blank only after a successful save; keep input on errors.
    <form key={state.message ?? "form"} onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="player_id" value={playerId} />
      <label className="block text-sm font-medium text-zinc-800">
        Date
        <input
          type="date"
          name="assessment_date"
          defaultValue={today}
          required
          className="mt-1 block h-10 rounded-lg border-0 bg-white px-3 ring-1 ring-inset ring-zinc-300"
        />
      </label>
      {GROUPS.map((g) => (
        <fieldset key={g}>
          <legend className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            {g}
          </legend>
          <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {METRICS.filter((m) => m.group === g).map((m) => (
              <label key={m.key} className="text-xs text-zinc-600">
                {m.label} ({m.unit})
                <input
                  name={m.key}
                  inputMode="decimal"
                  placeholder={m.key === "height_in" ? "73 = 6'1\"" : "—"}
                  className="mt-0.5 block h-10 w-full rounded-lg border-0 bg-white px-2 text-base tabular-nums ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-brand-600 sm:text-sm"
                />
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <label className="block text-sm font-medium text-zinc-800">
        Notes
        <textarea
          name="notes"
          rows={2}
          className="mt-1 block w-full rounded-lg border-0 px-3 py-2 text-base ring-1 ring-inset ring-zinc-300 sm:text-sm"
        />
      </label>
      <FormMessage state={state} />
      <SubmitButton pending={pending} pendingLabel="Saving…">
        Save assessment
      </SubmitButton>
    </form>
  );
}
