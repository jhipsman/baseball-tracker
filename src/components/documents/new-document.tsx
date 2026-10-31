"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createDocument } from "@/lib/document-actions";
import { DOC_KINDS, docPath, type DocKind } from "@/lib/documents";
import { Field } from "@/components/ui/field";
import { selectClass } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Upload a PDF and say who it's for and what they need to do. */
export function NewDocument({
  orgId,
  groups,
}: {
  orgId: string;
  groups: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [kind, setKind] = useState<DocKind>("sign");
  const [audience, setAudience] = useState<"families" | "staff">("families");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const needsFile = kind !== "upload";

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError("");
        if (needsFile && !file) return setError("Add the PDF.");
        if (file && file.type !== "application/pdf") return setError("Choose a PDF file.");
        if (file && file.size > 15 * 1024 * 1024) return setError("PDFs can be up to 15 MB.");
        start(async () => {
          const id = crypto.randomUUID();
          if (file) {
            const { error: up } = await createClient()
              .storage.from("team-docs")
              .upload(docPath.form(orgId, id), file, { contentType: "application/pdf" });
            if (up) return setError("The PDF didn't upload. Check your signal and try again.");
          }
          const res = await createDocument({
            id,
            title: String(fd.get("title") ?? ""),
            description: String(fd.get("description") ?? ""),
            kind,
            audience,
            groupId: String(fd.get("group") ?? "") || null,
            dueDate: String(fd.get("due") ?? "") || null,
            hasFile: !!file,
            notify: fd.get("notify") === "on",
          });
          if (res.error) return setError(res.error);
          router.push(`/documents/${id}`);
        });
      }}
    >
      <Field
        label="Name"
        name="title"
        required
        maxLength={120}
        placeholder="Medical release 2027"
      />
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-zinc-800">What do they need to do?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {DOC_KINDS.map((k) => (
            <label
              key={k.key}
              className={cn(
                "flex cursor-pointer gap-3 rounded-xl p-3 ring-1",
                kind === k.key
                  ? "bg-brand-50 ring-2 ring-brand-600"
                  : "ring-zinc-200 hover:bg-zinc-50",
              )}
            >
              <input
                type="radio"
                name="kind"
                checked={kind === k.key}
                onChange={() => setKind(k.key)}
                className="mt-0.5 size-5 shrink-0 accent-brand-700"
              />
              <span>
                <b className="block text-sm">{k.label}</b>
                <span className="text-xs text-zinc-600">{k.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1.5">
        <label htmlFor="doc-file" className="block text-sm font-medium text-zinc-800">
          PDF {needsFile ? "" : "(optional, e.g. a form to fill in)"}
        </label>
        <input
          id="doc-file"
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm file:mr-3 file:h-11 file:rounded-full file:border-0 file:bg-zinc-900 file:px-4 file:font-semibold file:text-zinc-50"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label htmlFor="doc-audience" className="block text-sm font-medium text-zinc-800">
            Who it&apos;s for
          </label>
          <select
            id="doc-audience"
            value={audience}
            onChange={(e) => setAudience(e.target.value as "families" | "staff")}
            className={cn(selectClass, "w-full")}
          >
            <option value="families">Families (one per player)</option>
            <option value="staff">Coaches and staff</option>
          </select>
        </div>
        {audience === "families" && groups.length ? (
          <div className="space-y-1.5">
            <label htmlFor="doc-group" className="block text-sm font-medium text-zinc-800">
              Group
            </label>
            <select
              id="doc-group"
              name="group"
              defaultValue=""
              className={cn(selectClass, "w-full")}
            >
              <option value="">Whole team</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <Field label="Due" name="due" type="date" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="doc-desc" className="block text-sm font-medium text-zinc-800">
          Note (optional)
        </label>
        <textarea
          id="doc-desc"
          name="description"
          maxLength={1000}
          rows={2}
          placeholder="Needed before the first practice."
          className="block w-full rounded-lg bg-surface px-3 py-2 text-sm ring-1 ring-zinc-300 ring-inset"
        />
      </div>
      {kind !== "read" ? (
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" name="notify" defaultChecked className="size-5 accent-brand-700" />
          Notify everyone it&apos;s for now
        </label>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-full bg-brand-700 px-6 font-semibold text-on-brand disabled:opacity-60"
      >
        {pending ? "Uploading…" : "Add document"}
      </button>
    </form>
  );
}
