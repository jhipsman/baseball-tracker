"use client";

import Link from "next/link";
import type { FormState } from "@/lib/auth/actions";
import type { Tables } from "@/types/database";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SelectField } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFormAction } from "@/components/ui/use-form-action";
import {
  CATEGORY_LABELS,
  EQUIPMENT,
  EXERCISE_CATEGORIES,
  MUSCLE_GROUPS,
  humanize,
} from "@/constants";
import { deleteExercise, saveExercise } from "./actions";

const textareaClass =
  "block w-full rounded-lg border-0 bg-white px-3 py-2 text-base text-zinc-900 ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-brand-600 sm:text-sm";

function CheckboxGroup({
  legend,
  name,
  options,
  selected,
}: {
  legend: string;
  name: string;
  options: readonly string[];
  selected: string[];
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-zinc-800">{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o}
            className="flex cursor-pointer items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm ring-1 ring-inset ring-zinc-300 has-checked:bg-brand-50 has-checked:ring-brand-600"
          >
            <input
              type="checkbox"
              name={name}
              value={o}
              defaultChecked={selected.includes(o)}
              className="accent-brand-700"
            />
            {humanize(o)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ExerciseForm({ exercise }: { exercise?: Tables<"exercises"> }) {
  const save = useFormAction<FormState>(saveExercise, {});
  const del = useFormAction<FormState>(deleteExercise, {});
  const state = save.state;
  const deleteState = del.state;

  return (
    <div className="space-y-6">
      <form
        onSubmit={save.onSubmit}
        className="space-y-5 rounded-xl bg-white p-5 ring-1 ring-zinc-200"
      >
        {exercise ? <input type="hidden" name="id" value={exercise.id} /> : null}
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
          <Field label="Name" name="name" defaultValue={exercise?.name} required />
          <SelectField
            label="Category"
            name="category"
            defaultValue={exercise?.category ?? "strength"}
          >
            {EXERCISE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="description" className="block text-sm font-medium text-zinc-800">
            Short description
          </label>
          <input
            id="description"
            name="description"
            defaultValue={exercise?.description ?? ""}
            className={textareaClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="instructions" className="block text-sm font-medium text-zinc-800">
            Instructions &amp; coaching cues
          </label>
          <textarea
            id="instructions"
            name="instructions"
            rows={4}
            defaultValue={exercise?.instructions ?? ""}
            className={textareaClass}
          />
        </div>
        <CheckboxGroup
          legend="Muscle groups"
          name="muscle_groups"
          options={MUSCLE_GROUPS}
          selected={exercise?.muscle_groups ?? []}
        />
        <CheckboxGroup
          legend="Equipment"
          name="equipment"
          options={EQUIPMENT}
          selected={exercise?.equipment ?? []}
        />
        <Field
          label="Demo video URL"
          name="video_demo_url"
          type="url"
          placeholder="https://youtube.com/…"
          defaultValue={exercise?.video_demo_url ?? ""}
        />
        <FormMessage state={state} />
        <div className="flex items-center gap-3">
          <SubmitButton pending={save.pending} pendingLabel="Saving…">
            {exercise ? "Save changes" : "Create exercise"}
          </SubmitButton>
          <Link href="/exercises" className="text-sm font-medium text-zinc-600 hover:underline">
            Cancel
          </Link>
        </div>
      </form>

      {exercise ? (
        <form onSubmit={del.onSubmit} className="space-y-2">
          <input type="hidden" name="id" value={exercise.id} />
          <FormMessage state={deleteState} />
          <SubmitButton
            pending={del.pending}
            variant="ghost"
            className="text-red-700"
            pendingLabel="Deleting…"
          >
            Delete exercise
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
