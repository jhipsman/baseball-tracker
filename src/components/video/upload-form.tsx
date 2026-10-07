"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select";
import { VIDEO_TYPES } from "@/constants/video";
import { createVideo } from "@/lib/video-actions";
import { uuid } from "@/lib/uuid";
import type { Enums } from "@/types/database";
import { checkVideoFile, probeFile, removeFiles, uploadFile, videoMime } from "./media";

type Props = {
  orgId: string;
  /** The signed-in player's id, or null for staff (who pick a player). */
  selfId: string | null;
  players?: { id: string; name: string }[];
  defaultPlayerId?: string;
  /** Where to go after upload; `{id}` is replaced. */
  redirectTo: string;
};

export function VideoUploadForm({
  orgId,
  selfId,
  players = [],
  defaultPlayerId,
  redirectTo,
}: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [playerId, setPlayerId] = useState(selfId ?? defaultPlayerId ?? "");
  const [type, setType] = useState<Enums<"video_type">>("hitting");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function pick(f: File | null) {
    setError(null);
    if (!f) return setFile(null);
    const problem = checkVideoFile(f);
    if (problem) {
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      return setError(problem);
    }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, "").slice(0, 120));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) return setError("Choose a video first.");
    if (!playerId) return setError("Choose a player.");
    if (!title.trim()) return setError("Give the video a title.");
    const kind = videoMime(file)!;
    const id = uuid();
    const folder = `${orgId}/${playerId}/${id}`;
    const path = `${folder}/original.${kind.ext}`;
    const uploaded: string[] = [];
    setProgress(0);
    try {
      const { durationS, thumb } = await probeFile(file);
      await uploadFile(path, file, kind.mime, (f) => setProgress(f));
      uploaded.push(path);
      let thumbPath: string | null = null;
      if (thumb) {
        thumbPath = `${folder}/thumb.jpg`;
        await uploadFile(thumbPath, thumb, "image/jpeg").then(
          () => uploaded.push(thumbPath!),
          () => (thumbPath = null),
        );
      }
      const res = await createVideo({
        id,
        playerId,
        type,
        title,
        notes,
        path,
        thumbPath,
        mime: kind.mime,
        size: file.size,
        durationS,
      });
      if (res.error) throw new Error(res.error);
      router.push(redirectTo.replace("{id}", id));
    } catch (err) {
      await removeFiles(uploaded).catch(() => {});
      setProgress(null);
      setError(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  const busy = progress !== null;
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="video-file" className="block text-sm font-medium text-zinc-800">
          Video
        </label>
        <input
          ref={fileRef}
          id="video-file"
          type="file"
          accept="video/mp4,video/quicktime,video/webm,video/x-m4v,video/3gpp,.mov,.mp4,.m4v,.webm"
          disabled={busy}
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-zinc-700 file:mr-3 file:h-11 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:font-semibold file:text-brand-800"
        />
        <p className="text-xs text-zinc-500">
          Up to 50 MB. Trim to the rep you want reviewed; side or behind views work best.
        </p>
      </div>

      {selfId ? null : (
        <SelectField
          label="Player"
          name="player"
          value={playerId}
          disabled={busy}
          onChange={(e) => setPlayerId(e.target.value)}
        >
          <option value="">Choose a player…</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>
      )}

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-zinc-800">What&apos;s in it?</legend>
        <div className="flex flex-wrap gap-2">
          {VIDEO_TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              disabled={busy}
              aria-pressed={type === t.key}
              onClick={() => setType(t.key)}
              className={
                type === t.key
                  ? "h-10 rounded-full bg-brand-700 px-4 text-sm font-semibold text-white"
                  : "h-10 rounded-full bg-white px-4 text-sm font-medium text-zinc-700 ring-1 ring-zinc-300"
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </fieldset>

      <Field
        label="Title"
        name="title"
        value={title}
        maxLength={120}
        disabled={busy}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Tee work, front view"
      />
      <div className="space-y-1.5">
        <label htmlFor="video-notes" className="block text-sm font-medium text-zinc-800">
          Notes for the coach <span className="font-normal text-zinc-500">(optional)</span>
        </label>
        <textarea
          id="video-notes"
          rows={2}
          maxLength={2000}
          value={notes}
          disabled={busy}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What should they look at?"
          className="block w-full rounded-lg border-0 px-3 py-2 text-base ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-brand-600 sm:text-sm"
        />
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {busy ? (
        <div role="status" className="space-y-1">
          <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
            <div
              className="h-full bg-brand-600 transition-[width]"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="text-xs text-zinc-600">
            {progress < 1 ? `Uploading… ${Math.round(progress * 100)}%` : "Saving…"}
          </p>
        </div>
      ) : null}
      <Button type="submit" disabled={busy || !file} className="w-full sm:w-auto">
        {busy ? "Uploading…" : "Upload video"}
      </Button>
    </form>
  );
}
