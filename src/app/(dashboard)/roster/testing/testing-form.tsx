"use client";

import type { FormState } from "@/lib/auth/actions";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFormAction } from "@/components/ui/use-form-action";
import { formatMetric, METRIC_BY_KEY } from "@/constants/metrics";
import { saveTestingDay } from "../assess-actions";

export function TestingForm({
  today,
  metrics,
  players,
}: {
  today: string;
  metrics: string[];
  players: { id: string; name: string; detail: string; latest: Record<string, number> }[];
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(saveTestingDay, {});
  return (
    <form key={state.message ?? "grid"} onSubmit={onSubmit} className="space-y-4">
      <label className="block text-sm font-medium text-zinc-800">
        Testing date
        <input
          type="date"
          name="assessment_date"
          defaultValue={today}
          required
          className="mt-1 block h-10 rounded-lg border-0 bg-white px-3 ring-1 ring-inset ring-zinc-300"
        />
      </label>
      <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-zinc-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
              <th className="px-4 py-2 font-medium">Player</th>
              {metrics.map((k) => {
                const m = METRIC_BY_KEY.get(k)!;
                return (
                  <th key={k} className="px-2 py-2 font-medium">
                    {m.label} <span className="font-normal">({m.unit})</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id} className="border-b border-zinc-100 last:border-0">
                <th scope="row" className="px-4 py-1.5 text-left font-medium">
                  {p.name}
                  <span className="ml-2 text-xs font-normal text-zinc-500">{p.detail}</span>
                </th>
                {metrics.map((k) => (
                  <td key={k} className="px-2 py-1.5">
                    <input
                      name={`v:${p.id}:${k}`}
                      inputMode="decimal"
                      aria-label={`${p.name} ${METRIC_BY_KEY.get(k)!.label}`}
                      placeholder={
                        p.latest[k] != null ? `last ${formatMetric(k, p.latest[k])}` : "—"
                      }
                      className="block h-10 w-full min-w-28 rounded-lg border-0 bg-white px-2 text-base tabular-nums ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-300 focus:ring-2 focus:ring-brand-600 sm:text-sm"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <FormMessage state={state} />
      <SubmitButton pending={pending} pendingLabel="Saving…">
        Save results
      </SubmitButton>
    </form>
  );
}
