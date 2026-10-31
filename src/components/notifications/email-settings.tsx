"use client";

import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import { useFormAction } from "@/components/ui/use-form-action";
import { saveEmailPreferences } from "@/lib/notification-actions";

/** Which kinds of updates also arrive by email. */
export function EmailSettings({
  email,
  kinds,
  muted,
}: {
  email: string;
  kinds: { key: string; label: string }[];
  muted: string[];
}) {
  const prefs = useFormAction(saveEmailPreferences, {});
  return (
    <form onSubmit={prefs.onSubmit} className="space-y-2">
      <p className="text-sm text-zinc-600">
        Sent to <b className="text-zinc-900">{email}</b>. Several updates at once come in one email.
      </p>
      <ul className="space-y-1">
        {kinds.map((k) => (
          <li key={k.key}>
            <input type="hidden" name="shown" value={k.key} />
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="on"
                value={k.key}
                defaultChecked={!muted.includes(k.key)}
                className="size-5 accent-brand-700"
              />
              {k.label}
            </label>
          </li>
        ))}
      </ul>
      <FormMessage state={prefs.state} />
      <SubmitButton pending={prefs.pending} variant="secondary">
        Save email choices
      </SubmitButton>
    </form>
  );
}
