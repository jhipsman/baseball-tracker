"use client";

import Link from "next/link";
import { useState } from "react";
import type { FormState } from "@/lib/auth/actions";
import type { Tables } from "@/types/database";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SelectField, selectClass } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFormAction } from "@/components/ui/use-form-action";
import { cn } from "@/lib/utils";
import {
  CATEGORY_LABELS,
  EQUIPMENT,
  EXERCISE_CATEGORIES,
  MUSCLE_GROUPS,
  TRACKING_HINTS,
  TRACKING_LABELS,
  TRACKING_TYPES,
  humanize,
  type TrackingType,
} from "@/constants";
import { ExerciseDemo } from "@/components/exercise-demo";
import { parseDemoVideo } from "@/lib/exercise-video";
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
  const [tracking, setTracking] = useState<TrackingType>(exercise?.tracking_type ?? "weight_reps");
  const [videoUrl, setVideoUrl] = useState(exercise?.video_demo_url ?? "");
  const videoOk = videoUrl.trim() === "" || parseDemoVideo(videoUrl) != null;

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
          <label htmlFor="tracking_type" className="block text-sm font-medium text-zinc-800">
            How it&apos;s tracked
          </label>
          <select
            id="tracking_type"
            name="tracking_type"
            value={tracking}
            onChange={(e) => setTracking(e.target.value as TrackingType)}
            aria-describedby="tracking_hint"
            className={selectClass + " w-full sm:w-72"}
          >
            {TRACKING_TYPES.map((t) => (
              <option key={t} value={t}>
                {TRACKING_LABELS[t]}
              </option>
            ))}
          </select>
          <p id="tracking_hint" className="text-xs text-zinc-500">
            {TRACKING_HINTS[tracking]}
          </p>
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
        <div className="space-y-1.5">
          <label htmlFor="video_demo_url" className="block text-sm font-medium text-zinc-800">
            Demo video link
          </label>
          <div className="flex items-center gap-2">
            <input
              id="video_demo_url"
              name="video_demo_url"
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              maxLength={500}
              placeholder="https://www.youtube.com/watch?v=…"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              aria-invalid={!videoOk}
              aria-describedby="video_hint"
              className={cn(
                textareaClass,
                "h-11 min-w-0 flex-1 py-0",
                !videoOk && "ring-red-400 focus:ring-red-500",
              )}
            />
            {videoOk && videoUrl.trim() ? (
              <ExerciseDemo name={exercise?.name ?? "New exercise"} url={videoUrl} />
            ) : null}
          </div>
          <p id="video_hint" className={cn("text-xs", videoOk ? "text-zinc-500" : "text-red-700")}>
            {videoOk
              ? "YouTube (including Shorts) or Vimeo link; add ?t=30 to start at 0:30. Players watch it without leaving their workout."
              : "That doesn't look like a YouTube or Vimeo video link."}
          </p>
        </div>
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
