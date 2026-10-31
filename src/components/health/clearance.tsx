"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { attachClearance, openHealthFile } from "@/lib/health-actions";
import { docPath, extFor, MAX_UPLOAD_BYTES, UPLOAD_TYPES } from "@/lib/documents";
import { ViewButton } from "@/components/ui/view-button";

/** Open a doctor's note in a new tab (short-lived signed link). */
export function OpenHealthFile({ path, label = "Open" }: { path: string; label?: string }) {
  const [error, setError] = useState("");
  return (
    <>
      <ViewButton
        onPress={async () => {
          const w = window.open("", "_blank");
          const res = await openHealthFile(path);
          if (res.url && w) w.location.href = res.url;
          else {
            w?.close();
            setError(res.error ?? "Couldn't open it.");
          }
        }}
        className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-700"
      >
        {label}
      </ViewButton>
      {error ? <span className="text-sm text-red-700">{error}</span> : null}
    </>
  );
}

/**
 * The doctor's note for the current injury: shows it if one is on file,
 * otherwise lets a coach, the player or a parent upload a photo or PDF of it.
 */
export function ClearanceUpload({
  orgId,
  playerId,
  path,
  uploadedAt,
  concussion,
  audience,
}: {
  orgId: string;
  playerId: string;
  path: string | null;
  uploadedAt: string | null;
  concussion: boolean;
  audience: "staff" | "family";
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [replacing, setReplacing] = useState(false);

  if (path && !replacing) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" data-testid="clearance">
        <span className="font-semibold text-brand-800">✓ Doctor&apos;s note on file</span>
        {uploadedAt ? (
          <span className="text-zinc-500">
            {new Date(uploadedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        ) : null}
        <OpenHealthFile path={path} />
        <button
          type="button"
          onClick={() => setReplacing(true)}
          className="min-h-11 text-sm font-medium text-zinc-600"
        >
          Replace
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="clearance">
      <p className="text-sm">
        {concussion
          ? audience === "staff"
            ? "Required before they return: a doctor's written clearance."
            : "Before returning, the team needs a doctor's written clearance. Upload a photo or PDF of it here."
          : "Have a doctor's note? Add a photo or PDF so the coaches have it."}
      </p>
      <label className="block text-sm font-medium">
        <span className="sr-only">Doctor&apos;s note</span>
        <input
          type="file"
          accept={UPLOAD_TYPES.join(",")}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm file:mr-3 file:h-11 file:rounded-full file:border-0 file:bg-zinc-900 file:px-4 file:font-semibold file:text-zinc-50"
        />
      </label>
      <button
        type="button"
        disabled={!file || pending}
        onClick={() =>
          start(async () => {
            setError("");
            if (!file) return;
            if (!UPLOAD_TYPES.includes(file.type)) return setError("Choose a photo or PDF.");
            if (file.size > MAX_UPLOAD_BYTES) return setError("Files can be up to 15 MB.");
            const p = docPath.health(orgId, playerId, extFor(file.type, file.name));
            const { error: up } = await createClient()
              .storage.from("team-docs")
              .upload(p, file, { contentType: file.type });
            if (up)
              return setError("The upload didn't go through. Check your signal and try again.");
            const res = await attachClearance(playerId, p);
            if (res.error) return setError(res.error);
            setFile(null);
            setReplacing(false);
            router.refresh();
          })
        }
        className="h-11 rounded-full bg-brand-700 px-5 text-sm font-semibold text-on-brand disabled:opacity-50"
      >
        {pending ? "Uploading…" : "Upload doctor's note"}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
