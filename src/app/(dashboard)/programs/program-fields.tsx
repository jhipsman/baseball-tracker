import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select";
import {
  PROGRAM_TYPE_LABELS,
  PROGRAM_TYPES,
  SEASON_PHASE_LABELS,
  SEASON_PHASES,
} from "@/constants";

const textareaClass =
  "block w-full rounded-lg border-0 bg-white px-3 py-2 text-base text-zinc-900 ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-brand-600 sm:text-sm";

export type ProgramDefaults = {
  name?: string;
  description?: string | null;
  program_type?: string;
  season_phase?: string | null;
  is_template?: boolean;
};

export function ProgramFields({ defaults = {} }: { defaults?: ProgramDefaults }) {
  return (
    <>
      <Field
        label="Program name"
        name="name"
        placeholder="Off-Season Phase 1 — Hypertrophy"
        defaultValue={defaults.name}
        required
      />
      <div className="space-y-1.5">
        <label htmlFor="description" className="block text-sm font-medium text-zinc-800">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          defaultValue={defaults.description ?? ""}
          className={textareaClass}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Program type"
          name="program_type"
          defaultValue={defaults.program_type ?? "strength"}
        >
          {PROGRAM_TYPES.map((t) => (
            <option key={t} value={t}>
              {PROGRAM_TYPE_LABELS[t]}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Season phase"
          name="season_phase"
          defaultValue={defaults.season_phase ?? ""}
        >
          <option value="">Any</option>
          {SEASON_PHASES.map((p) => (
            <option key={p} value={p}>
              {SEASON_PHASE_LABELS[p]}
            </option>
          ))}
        </SelectField>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="is_template"
          defaultChecked={defaults.is_template}
          className="size-4 accent-brand-700"
        />
        Save as a reusable template
      </label>
    </>
  );
}
