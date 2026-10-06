"use client";

import { useActionState, useTransition, type FormEvent } from "react";

/**
 * Like useActionState, but submits via onSubmit so React does NOT reset the
 * form afterwards. (Passing an action to <form action> resets uncontrolled
 * fields to their defaults, which wipes input on errors and shows stale
 * values after a save.)
 */
export function useFormAction<S>(
  fn: (prev: Awaited<S>, formData: FormData) => S | Promise<S>,
  initial: Awaited<S>,
) {
  const [state, dispatch, actionPending] = useActionState(fn, initial);
  const [transitionPending, startTransition] = useTransition();

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const formData = new FormData(e.currentTarget, submitter);
    startTransition(() => dispatch(formData));
  };

  return { state, onSubmit, pending: actionPending || transitionPending };
}
