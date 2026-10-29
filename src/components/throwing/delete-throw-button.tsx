"use client";

/** Submit button for deleting a throwing log: confirms first, since workload math depends on it. */
export function DeleteThrowButton({ what }: { what: string }) {
  return (
    <button
      type="submit"
      aria-label={`Delete ${what}`}
      onClick={(e) => {
        if (!confirm(`Delete ${what}? Pitch counts and rest days will be recalculated.`)) {
          e.preventDefault();
        }
      }}
      className="-mr-2 h-11 rounded-lg px-2 text-xs font-semibold text-zinc-500 hover:text-red-700 active:bg-red-50"
    >
      Delete
    </button>
  );
}
