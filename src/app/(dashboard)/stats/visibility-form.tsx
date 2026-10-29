"use client";

import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFormAction } from "@/components/ui/use-form-action";
import { setStatsVisibility, type SaveResult } from "@/lib/stats-actions";
import { cn } from "@/lib/utils";

const OPTIONS = [
  {
    value: "team",
    title: "Whole team",
    body: "Players and parents see everyone's stats: box scores, team tables and leaders. The usual for baseball.",
  },
  {
    value: "own",
    title: "Each family sees only their own player",
    body: "Players and parents see only their own player's lines and season stats. No team tables or leaders. Coaches still see everything.",
  },
] as const;

export function VisibilityForm({
  current,
  canEdit,
}: {
  current: "team" | "own";
  canEdit: boolean;
}) {
  const { state, onSubmit, pending } = useFormAction<SaveResult>(setStatsVisibility, {});
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <fieldset disabled={!canEdit} className="space-y-2">
        <legend className="text-sm font-semibold">Who can see stats?</legend>
        {OPTIONS.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex cursor-pointer gap-3 rounded-lg p-3 ring-1 ring-inset has-[:checked]:bg-brand-50 has-[:checked]:ring-brand-600",
              "ring-zinc-200",
              !canEdit && "cursor-default",
            )}
          >
            <input
              type="radio"
              name="stats_visibility"
              value={o.value}
              defaultChecked={current === o.value}
              className="mt-1 accent-brand-700"
            />
            <span>
              <span className="block text-sm font-medium">{o.title}</span>
              <span className="block text-xs text-zinc-600">{o.body}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {canEdit ? (
        <>
          <FormMessage state={state} />
          <SubmitButton pending={pending} pendingLabel="Saving…" variant="secondary">
            Save setting
          </SubmitButton>
        </>
      ) : (
        <p className="text-xs text-zinc-500">Only a team admin can change this setting.</p>
      )}
    </form>
  );
}
