"use client";

import { switchOrg } from "@/lib/org-actions";

export function OrgSwitcher({
  orgs,
  activeId,
}: {
  orgs: { id: string; name: string }[];
  activeId: string;
}) {
  return (
    <form action={switchOrg}>
      <label htmlFor="org-switcher" className="sr-only">
        Switch organization
      </label>
      <select
        id="org-switcher"
        name="org_id"
        defaultValue={activeId}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="w-full truncate rounded-md border-0 bg-zinc-50 py-1 pr-7 pl-2 text-xs text-zinc-700 ring-1 ring-inset ring-zinc-200"
      >
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </form>
  );
}
