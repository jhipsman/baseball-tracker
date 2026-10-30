"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import { useFormAction } from "@/components/ui/use-form-action";
import { Button } from "@/components/ui/button";
import {
  postAnnouncement,
  previewAnnouncement,
  saveMessageTemplate,
  type MessageFormState,
} from "@/lib/message-actions";
import { textareaClass } from "./styles";

export function AnnouncementForm({
  groups,
  templates = [],
  isAdmin = false,
}: {
  groups: { id: string; name: string }[];
  templates?: { id: string; title: string; body: string }[];
  isAdmin?: boolean;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("team");
  const [parents, setParents] = useState(true);
  const [scope, setScope] = useState("audience");
  const [preview, setPreview] = useState<{
    fingerprint: string;
    recipients: { profile_id: string; display_name: string }[];
  } | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [templateMessage, setTemplateMessage] = useState("");
  const [working, start] = useTransition();

  const { state, onSubmit, pending } = useFormAction<MessageFormState>(postAnnouncement, {});
  const [lastPosted, setLastPosted] = useState<number | undefined>(undefined);
  if (state.ok && state.ok !== lastPosted) {
    setLastPosted(state.ok);
    setTitle("");
    setBody("");
    setPreview(null);
  }
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state.ok]);

  return (
    <form ref={form} onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="audience_fingerprint" value={preview?.fingerprint ?? ""} />
      {templates.length > 0 && (
        <SelectField
          id="announcement-template"
          label="Start from a saved message"
          defaultValue=""
          onChange={(e) => {
            const t = templates.find((t) => t.id === e.target.value);
            if (t) {
              setTitle(t.title);
              setBody(t.body);
            }
          }}
        >
          <option value="">Choose a template</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </SelectField>
      )}
      <Field
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        label="Title"
        name="title"
        required
        maxLength={140}
        placeholder="Practice moved to 5pm"
      />
      <div className="space-y-1.5">
        <label htmlFor="announcement-body" className="block text-sm font-medium text-zinc-800">
          Message
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          id="announcement-body"
          name="body"
          required
          maxLength={5000}
          rows={4}
          className={textareaClass}
        />
      </div>
      <SelectField
        label="Who sees it"
        name="audience"
        value={audience}
        onChange={(e) => {
          setAudience(e.target.value);
          setPreview(null);
        }}
      >
        <option value="team">Whole team</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name} only
          </option>
        ))}
      </SelectField>
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm text-zinc-800">
          <input
            type="checkbox"
            name="include_parents"
            checked={parents}
            onChange={(e) => {
              setParents(e.target.checked);
              setPreview(null);
            }}
            className="size-4 accent-brand-700"
          />
          Also send to parents
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-800">
          <input type="checkbox" name="pinned" className="size-4 accent-brand-700" />
          Pin to the top
        </label>
      </div>

      {isAdmin ? (
        <SelectField
          label="Recipient filter"
          name="scope"
          value={scope}
          onChange={(e) => {
            setScope(e.target.value);
            setPreview(null);
          }}
        >
          <option value="audience">Everyone in selected audience</option>
          <option value="overdue">Only payers with overdue installments</option>
        </SelectField>
      ) : (
        <input type="hidden" name="scope" value="audience" />
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={working || pending}
          onClick={() =>
            start(async () => {
              setPreviewError("");
              try {
                const r = await previewAnnouncement({ audience, parents, scope });
                if (r.error) setPreviewError(r.error);
                else if (r.fingerprint && r.recipients)
                  setPreview({ fingerprint: r.fingerprint, recipients: r.recipients });
              } catch {
                setPreview(null);
                setPreviewError(
                  "Recipients could not be loaded. Check your connection and try again.",
                );
              }
            })
          }
        >
          {working ? "Working…" : "Review recipients"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={working || pending || !title.trim() || !body.trim()}
          onClick={() =>
            start(async () => {
              try {
                const r = await saveMessageTemplate({ title, body });
                setTemplateMessage(r.error ?? "Message saved as a reusable template.");
              } catch {
                setTemplateMessage(
                  "The template did not save. Check your connection and try again.",
                );
              }
            })
          }
        >
          Save as template
        </Button>
      </div>
      {preview && (
        <div className="space-y-2 rounded-lg bg-zinc-50 p-3 text-sm">
          <p className="font-semibold">{preview.recipients.length} recipients</p>
          <p className="text-xs text-zinc-600">
            {preview.recipients
              .slice(0, 30)
              .map((r) => r.display_name)
              .join(", ")}
            {preview.recipients.length > 30 ? `, and ${preview.recipients.length - 30} more` : ""}
          </p>
          <p className="text-xs text-zinc-600">
            Posts in the app; push alerts are sent where enabled. This does not send email or SMS.
          </p>
        </div>
      )}
      {previewError && (
        <p role="alert" className="text-sm text-red-800">
          {previewError}
        </p>
      )}
      {templateMessage && (
        <p role="status" className="text-sm text-zinc-600">
          {templateMessage}
        </p>
      )}
      <FormMessage state={state} />
      <SubmitButton
        disabled={!preview || working}
        pending={pending}
        pendingLabel="Posting…"
        className="w-full"
      >
        Post announcement
      </SubmitButton>
    </form>
  );
}
