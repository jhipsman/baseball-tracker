"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/lib/auth/actions";
import { MODULES, TEAM_TYPES, type ModuleKey } from "@/constants/modules";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { selectClass } from "@/components/ui/select";
import { updateTeamSettings } from "./actions";

export function SettingsForm({
  teamType,
  modules,
}: {
  teamType: string | null;
  modules: ModuleKey[];
}) {
  const [state, action] = useActionState<FormState, FormData>(updateTeamSettings, {});
  const [type, setType] = useState(teamType ?? "");
  const [on, setOn] = useState<ModuleKey[]>(modules);
  const preset = TEAM_TYPES.find((t) => t.key === type);
  const matchesPreset =
    preset && preset.modules.length === on.length && preset.modules.every((m) => on.includes(m));

  return (
    <form action={action} className="space-y-6">
      <div className="space-y-1.5">
        <label htmlFor="team_type" className="block text-sm font-medium text-zinc-800">
          Type of team
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <select
            id="team_type"
            name="team_type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={selectClass}
          >
            <option value="">Not set</option>
            {TEAM_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
          {preset && !matchesPreset ? (
            <button
              type="button"
              onClick={() => setOn([...preset.modules])}
              className="text-sm font-semibold text-brand-700 hover:underline"
            >
              Use the recommended features for this type
            </button>
          ) : null}
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-zinc-800">Features</legend>
        <p className="text-sm text-zinc-600">
          Turn off what your team doesn&apos;t use. It disappears for coaches, players, and parents;
          nothing is deleted, so you can turn it back on any time. Programs, workouts, the calendar,
          and the roster are always on.
        </p>
        <ul className="divide-y divide-zinc-100 rounded-xl bg-white ring-1 ring-zinc-200">
          {MODULES.map((m) => (
            <li key={m.key}>
              <label className="flex cursor-pointer items-start gap-3 p-4">
                <input
                  type="checkbox"
                  name="modules"
                  value={m.key}
                  checked={on.includes(m.key)}
                  onChange={(e) =>
                    setOn((cur) =>
                      e.target.checked ? [...cur, m.key] : cur.filter((k) => k !== m.key),
                    )
                  }
                  className="mt-1 size-5 accent-brand-700"
                />
                <span>
                  <span className="block font-medium text-zinc-900">{m.label}</span>
                  <span className="block text-sm text-zinc-600">{m.description}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <FormMessage state={state} />
      <SubmitButton pendingLabel="Saving…">Save settings</SubmitButton>
    </form>
  );
}
