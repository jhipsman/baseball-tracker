"use client";

import { useEffect, useRef } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFormAction } from "@/components/ui/use-form-action";
import { sendMessage, type MessageFormState } from "@/lib/message-actions";
import { textareaClass } from "./styles";

export function ReplyForm({ threadId }: { threadId: string }) {
  const form = useRef<HTMLFormElement>(null);
  const { state, onSubmit, pending } = useFormAction<MessageFormState>(sendMessage, {});
  useEffect(() => {
    if (state.ok) {
      form.current?.reset();
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }
  }, [state.ok]);

  return (
    <form ref={form} onSubmit={onSubmit} className="space-y-2">
      <input type="hidden" name="thread_id" value={threadId} />
      <label htmlFor="reply" className="sr-only">
        Reply
      </label>
      <textarea
        id="reply"
        name="body"
        required
        maxLength={4000}
        rows={3}
        placeholder="Write a reply…"
        className={textareaClass}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
        }}
      />
      {state.error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      <div className="flex justify-end">
        <SubmitButton pending={pending} pendingLabel="Sending…">
          Send
        </SubmitButton>
      </div>
    </form>
  );
}
