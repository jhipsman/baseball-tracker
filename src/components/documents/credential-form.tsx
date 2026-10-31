"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { addCredential, removeCredential } from "@/lib/document-actions";
import {
  CREDENTIALS,
  docPath,
  extFor,
  MAX_UPLOAD_BYTES,
  UPLOAD_TYPES,
  type CredentialKind,
} from "@/lib/documents";
import { Field } from "@/components/ui/field";
import { selectClass } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** A coach adds one of their certifications (photo or PDF, with dates). */
export function CredentialForm({ orgId, userId }: { orgId: string; userId: string }) {
  const [kind, setKind] = useState<CredentialKind>("background_check");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        setMsg(null);
        if (!file) return setMsg({ ok: false, text: "Add a photo or PDF of it." });
        if (!UPLOAD_TYPES.includes(file.type) || file.size > MAX_UPLOAD_BYTES)
          return setMsg({ ok: false, text: "Choose a photo or PDF up to 15 MB." });
        start(async () => {
          const path = docPath.credential(orgId, userId, extFor(file.type, file.name));
          const { error } = await createClient()
            .storage.from("team-docs")
            .upload(path, file, { contentType: file.type });
          if (error) return setMsg({ ok: false, text: "The upload didn't go through. Try again." });
          const res = await addCredential({
            kind,
            label: String(fd.get("label") ?? ""),
            path,
            issuedOn: String(fd.get("issued") ?? "") || null,
            expiresOn: String(fd.get("expires") ?? "") || null,
          });
          if (res.error) return setMsg({ ok: false, text: res.error });
          form.reset();
          setFile(null);
          setMsg({ ok: true, text: "Saved." });
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="cred-kind" className="block text-sm font-medium text-zinc-800">
            What is it?
          </label>
          <select
            id="cred-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as CredentialKind)}
            className={cn(selectClass, "w-full")}
          >
            {CREDENTIALS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        {kind === "other" ? (
          <Field label="Name" name="label" maxLength={120} placeholder="Umpire clinic" />
        ) : null}
        <Field label="Issued" name="issued" type="date" />
        <Field label="Expires" name="expires" type="date" hint="Leave blank if it doesn't." />
      </div>
      <label className="block text-sm font-medium">
        Photo or PDF of the certificate
        <input
          type="file"
          accept={UPLOAD_TYPES.join(",")}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mt-2 block w-full text-sm file:mr-3 file:h-11 file:rounded-full file:border-0 file:bg-zinc-900 file:px-4 file:font-semibold file:text-zinc-50"
        />
      </label>
      {msg ? (
        <p role="status" className={msg.ok ? "text-sm text-brand-800" : "text-sm text-red-700"}>
          {msg.text}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-full bg-brand-700 px-5 text-sm font-semibold text-on-brand disabled:opacity-60"
      >
        {pending ? "Uploading…" : "Add certification"}
      </button>
    </form>
  );
}

export function RemoveCredential({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => void (await removeCredential(id)))}
      className="min-h-11 px-2 text-sm font-medium text-zinc-500 hover:text-red-700"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
