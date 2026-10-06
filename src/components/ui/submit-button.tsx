"use client";

import { useFormStatus } from "react-dom";
import { Button } from "./button";

export function SubmitButton({
  children,
  pendingLabel,
  disabled,
  pending: pendingProp,
  ...props
}: React.ComponentProps<typeof Button> & { pendingLabel?: string; pending?: boolean }) {
  const status = useFormStatus();
  // `pending` is passed by forms using useFormAction (no form action, so no form status).
  const pending = status.pending || Boolean(pendingProp);
  const off = pending || Boolean(disabled);
  return (
    <Button type="submit" {...props} disabled={off} aria-disabled={off}>
      {pending ? (pendingLabel ?? "Working…") : children}
    </Button>
  );
}
