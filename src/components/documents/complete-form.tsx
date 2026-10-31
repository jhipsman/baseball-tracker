"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { acknowledgeDocument, recordUpload, signDocument } from "@/lib/document-actions";
import { docPath, extFor, MAX_UPLOAD_BYTES, UPLOAD_TYPES, type DocKind } from "@/lib/documents";

/** Draw a signature with a finger or mouse. */
function SignaturePad({ onChange }: { onChange: (png: string | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const inked = useRef(false);
  const [empty, setEmpty] = useState(true);
  useEffect(() => {
    const c = canvas.current!;
    const ctx = c.getContext("2d")!;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#18181b";
  }, []);
  const at = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [
      ((e.clientX - r.left) / r.width) * 600,
      ((e.clientY - r.top) / r.height) * 180,
    ] as const;
  };
  return (
    <div className="space-y-1">
      <canvas
        ref={canvas}
        width={600}
        height={180}
        aria-label="Signature pad: draw your signature"
        className="block aspect-[10/3] w-full touch-none rounded-xl bg-white ring-1 ring-zinc-300"
        onPointerDown={(e) => {
          drawing.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          const ctx = e.currentTarget.getContext("2d")!;
          const [x, y] = at(e);
          ctx.beginPath();
          ctx.moveTo(x, y);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = e.currentTarget.getContext("2d")!;
          const [x, y] = at(e);
          ctx.lineTo(x, y);
          ctx.stroke();
          inked.current = true;
          setEmpty(false);
        }}
        onPointerUp={(e) => {
          drawing.current = false;
          if (inked.current) onChange(e.currentTarget.toDataURL("image/png"));
        }}
      />
      <div className="flex justify-between text-xs text-zinc-500">
        <span>{empty ? "Optional: draw your signature" : "✓ Drawn"}</span>
        {!empty ? (
          <button
            type="button"
            className="min-h-8 font-semibold text-zinc-700"
            onClick={() => {
              const c = canvas.current!;
              c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
              inked.current = false;
              setEmpty(true);
              onChange(null);
            }}
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** What the person does with a form: confirm, sign or upload. */
export function CompleteForm({
  docId,
  orgId,
  kind,
  subjectId,
  subjectName,
  forSelf,
  defaultName,
}: {
  docId: string;
  orgId: string;
  kind: DocKind;
  subjectId: string;
  subjectName: string;
  forSelf: boolean;
  defaultName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [agree, setAgree] = useState(false);
  const [name, setName] = useState(defaultName);
  const [drawing, setDrawing] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const done = (res: { error?: string }) => (res.error ? setError(res.error) : router.refresh());

  if (kind === "read") return null;
  return (
    <section className="space-y-4 rounded-2xl bg-surface p-4 ring-1 ring-zinc-200 sm:p-5">
      {!forSelf ? (
        <p className="text-sm text-zinc-600">
          For <b className="text-zinc-900">{subjectName}</b>
        </p>
      ) : null}
      {kind === "acknowledge" ? (
        <label className="flex min-h-11 items-start gap-3">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-brand-700"
          />
          <span>
            I&apos;ve read this
            {forSelf ? "" : ` and gone over it with ${subjectName.split(" ")[0]}`}.
          </span>
        </label>
      ) : null}
      {kind === "sign" ? (
        <>
          <label className="block text-sm font-medium">
            Type your full name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              autoComplete="name"
              className="mt-1 block h-12 w-full rounded-lg bg-surface px-3 text-lg ring-1 ring-zinc-300"
            />
          </label>
          <SignaturePad onChange={setDrawing} />
          <label className="flex min-h-11 items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-brand-700"
            />
            <span>
              I agree to sign electronically, and that my typed name
              {drawing ? " and drawn signature are" : " is"} my signature on this form
              {forSelf ? "" : ` as ${subjectName.split(" ")[0]}'s parent or guardian`}.
            </span>
          </label>
        </>
      ) : null}
      {kind === "upload" ? (
        <label className="block text-sm font-medium">
          Choose a photo or PDF
          <input
            type="file"
            accept={UPLOAD_TYPES.join(",")}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-2 block w-full text-sm file:mr-3 file:h-11 file:rounded-full file:border-0 file:bg-zinc-900 file:px-4 file:font-semibold file:text-zinc-50"
          />
        </label>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={
          pending ||
          (kind !== "upload" && !agree) ||
          (kind === "upload" && !file) ||
          (kind === "sign" && name.trim().length < 2)
        }
        onClick={() =>
          start(async () => {
            setError("");
            if (kind === "acknowledge") return done(await acknowledgeDocument(docId, subjectId));
            if (kind === "sign")
              return done(await signDocument({ docId, subjectId, name, drawing, consent: agree }));
            if (!file) return;
            if (!UPLOAD_TYPES.includes(file.type)) return setError("Choose a photo or PDF.");
            if (file.size > MAX_UPLOAD_BYTES) return setError("Files can be up to 15 MB.");
            const path = docPath.response(orgId, subjectId, docId, extFor(file.type, file.name));
            const { error: up } = await createClient()
              .storage.from("team-docs")
              .upload(path, file, { contentType: file.type });
            if (up)
              return setError("The upload didn't go through. Check your signal and try again.");
            done(await recordUpload(docId, subjectId, path));
          })
        }
        className="h-14 w-full rounded-full bg-brand-700 text-base font-semibold text-on-brand disabled:opacity-50"
      >
        {pending ? "Saving…" : kind === "sign" ? "Sign" : kind === "upload" ? "Upload" : "Confirm"}
      </button>
    </section>
  );
}
