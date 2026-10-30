import type { Preview } from "@/lib/org";

/** Shown while an admin previews the app as a player or parent ("View as"). */
export function PreviewBar({ preview }: { preview: Preview }) {
  return (
    <div role="status" className="sticky top-0 z-30 bg-amber-100 text-amber-900 print:hidden">
      <div className="mx-auto flex max-w-md flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
        <p className="min-w-0 flex-1">
          <span className="font-semibold">Previewing as {preview.name}</span> ({preview.role}) ·
          read-only
        </p>
        <a
          href="/view-as/exit?next=/settings%23preview"
          className="font-semibold underline-offset-2 hover:underline"
        >
          Switch
        </a>
        <a href="/view-as/exit" className="font-semibold underline-offset-2 hover:underline">
          Exit preview
        </a>
      </div>
      <p className="mx-auto max-w-md px-4 pb-2 text-xs text-amber-800">
        Their private messages and notifications aren&apos;t shown. Buttons are turned off so
        nothing changes.
      </p>
    </div>
  );
}

/** Turns off every button and field in the page while previewing. */
export function ReadOnly({ on, children }: { on: boolean; children: React.ReactNode }) {
  if (!on) return children;
  return (
    <fieldset disabled className="m-0 min-w-0 border-0 p-0">
      {children}
    </fieldset>
  );
}
