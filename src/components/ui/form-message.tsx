import type { FormState } from "@/lib/auth/actions";

export function FormMessage({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {state.error}
      </p>
    );
  }
  if (state.message) {
    return (
      <p role="status" className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900">
        {state.message}
      </p>
    );
  }
  return null;
}
