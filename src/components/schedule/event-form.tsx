"use client";
import { useState } from "react";
import Link from "next/link";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import { useFormAction } from "@/components/ui/use-form-action";
import { buttonClass } from "@/components/ui/button";
import type { TeamOperationsTables } from "@/types/team-operations";
import { createTeamEvent, updateTeamEvent } from "@/lib/team-schedule-actions";
import type { FormState } from "@/lib/auth/actions";
import { addDays } from "@/lib/schedule";
export function EventForm({
  groups,
  today,
  initial,
}: {
  groups: { id: string; name: string }[];
  today: string;
  initial?: TeamOperationsTables["team_events"]["Row"];
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(
    initial ? updateTeamEvent : createTeamEvent,
    {},
  );
  const [count, setCount] = useState(1);
  const [date, setDate] = useState(initial?.date ?? today);
  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl bg-surface p-5 ring-1 ring-zinc-200">
      {initial && (
        <>
          <input type="hidden" name="event_id" value={initial.id} />
          <input type="hidden" name="updated_at" value={initial.updated_at} />
          <input type="hidden" name="count" value="1" />
        </>
      )}
      <Field
        defaultValue={initial?.title}
        label="Event title"
        name="title"
        required
        maxLength={120}
        placeholder="Team parent meeting"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Event type"
          name="event_type"
          defaultValue={initial?.event_type ?? "meeting"}
        >
          {["meeting", "training", "tryout", "social", "other"].map((t) => (
            <option key={t} value={t}>
              {t[0].toUpperCase() + t.slice(1)}
            </option>
          ))}
        </SelectField>
        <SelectField label="Who it’s for" name="group_id" defaultValue={initial?.group_id ?? ""}>
          <option value="">Whole team</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </SelectField>
        <Field
          label="Date"
          name="date"
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <Field
          label="Start time (team local time)"
          name="start_time"
          type="time"
          defaultValue={initial?.start_time?.slice(0, 5) ?? ""}
        />
        <Field
          label="Duration in minutes"
          name="duration_minutes"
          type="number"
          min={1}
          max={720}
          defaultValue={initial?.duration_minutes ?? 60}
          required
        />
        {!initial && (
          <Field
            label="Weekly occurrences"
            name="count"
            type="number"
            min={1}
            max={26}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            hint="1 for a single event; up to 26 for a weekly series."
          />
        )}
      </div>
      <Field
        defaultValue={initial?.location ?? ""}
        label="Location"
        name="location"
        maxLength={200}
        placeholder="Field 2"
      />
      <label className="block space-y-1 text-sm font-medium">
        Notes
        <textarea
          defaultValue={initial?.notes ?? ""}
          name="notes"
          rows={3}
          maxLength={4000}
          className="block w-full rounded-lg bg-surface p-3 ring-1 ring-zinc-300"
        />
      </label>
      {date && count > 1 && count <= 26 && (
        <p className="text-sm text-zinc-600">
          Creates {count} weekly events from {date} through {addDays(date, (count - 1) * 7)}. You
          can later change one occurrence or select the series.
        </p>
      )}
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="published" defaultChecked={initial?.published ?? true} />
        Show to players and families
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="notify" defaultChecked />
        Notify affected team members
      </label>
      {initial?.series_id && (
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="following" />
          Apply these details and the date/time change to this and later occurrences in the series
        </label>
      )}
      <FormMessage state={state} />
      <div className="flex flex-wrap gap-3">
        <SubmitButton pending={pending} pendingLabel={initial ? "Saving…" : "Creating…"}>
          {initial ? "Save event changes" : count > 1 ? "Create event series" : "Create event"}
        </SubmitButton>
        <Link href="/calendar/manage" className={buttonClass("ghost")}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
