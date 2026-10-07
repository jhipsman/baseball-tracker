"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AI_NOTE } from "@/constants/video";
import { analysisToText, type VideoAnalysis } from "@/lib/video/analysis";
import { formatClock, sampleTimes } from "@/lib/video/geometry";
import {
  deleteAiDraft,
  deleteVideo,
  reopenReview,
  saveBreakdown,
  sendReview,
  shareAiSummary,
} from "@/lib/video-actions";
import type { AiDraft, VideoDetail } from "@/lib/videos";
import { extractFrames } from "./media";
import { Reviewer, type PlayerApi } from "./reviewer";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** Browser recordings (WebM) often report an Infinity duration; seeking to the end makes the browser compute it. */
function fixUnknownDuration(e: React.SyntheticEvent<HTMLVideoElement>) {
  const v = e.currentTarget;
  if (v.duration !== Infinity) return;
  const reset = () => {
    v.removeEventListener("timeupdate", reset);
    v.currentTime = 0;
  };
  v.addEventListener("timeupdate", reset);
  v.currentTime = 1e7;
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      {children}
    </p>
  );
}

const textareaClass =
  "block w-full rounded-lg border-0 px-3 py-2 text-base ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-brand-600 sm:text-sm";

export function VideoWorkspace({
  video,
  mode,
  canDelete,
  aiEnabled,
  backHref,
}: {
  video: VideoDetail;
  mode: "coach" | "player";
  canDelete: boolean;
  aiEnabled: boolean;
  backHref: string;
}) {
  const apiRef = useRef<PlayerApi | null>(null);
  const [clock, setClock] = useState({ t: 0, d: Number(video.durationS ?? 0) });
  const onTime = useCallback(
    (t: number, d: number) => setClock((c) => ({ t, d: Number.isFinite(d) && d > 0 ? d : c.d })),
    [],
  );
  const coach = mode === "coach";

  return (
    <div className={coach ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]" : "space-y-4"}>
      <div className="min-w-0 space-y-4">
        {video.url ? (
          <Reviewer
            video={{ id: video.id, url: video.url, orgId: video.orgId, playerId: video.playerId }}
            annotations={video.annotations}
            canEdit={coach}
            onTime={onTime}
            apiRef={apiRef}
            belowPlayer={coach ? null : <PlayerFeedback video={video} />}
          />
        ) : (
          <Alert>This video file is missing.</Alert>
        )}
        {video.breakdownUrl ? (
          <section className="space-y-2">
            <h2 className="font-semibold">Narrated breakdown</h2>
            <video
              src={video.breakdownUrl}
              controls
              playsInline
              preload="metadata"
              onLoadedMetadata={fixUnknownDuration}
              className="max-h-[70vh] w-full rounded-xl bg-black"
            />
            {coach ? <RemoveBreakdown videoId={video.id} /> : null}
          </section>
        ) : null}
      </div>

      <aside className="space-y-4">
        {video.notes ? (
          <section className="rounded-xl bg-white p-4 text-sm ring-1 ring-zinc-200">
            <h2 className="font-semibold">Player&apos;s note</h2>
            <p className="mt-1 whitespace-pre-wrap text-zinc-700">{video.notes}</p>
          </section>
        ) : null}
        {coach ? <CoachReview video={video} /> : null}
        {coach ? (
          <AiPanel
            video={video}
            enabled={aiEnabled}
            time={clock.t}
            duration={clock.d}
            onSeek={(t) => apiRef.current?.seek(t)}
          />
        ) : null}
        {canDelete ? <DeleteVideo videoId={video.id} backHref={backHref} /> : null}
      </aside>
    </div>
  );
}

function CoachReview({ video }: { video: VideoDetail }) {
  const router = useRouter();
  const [summary, setSummary] = useState(video.reviewSummary ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const reviewed = video.status === "reviewed";

  return (
    <section className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-zinc-200">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Feedback for {video.playerName.split(" ")[0]}</h2>
        <StatusBadge status={video.status} />
      </div>
      <textarea
        aria-label="Feedback for the player"
        rows={5}
        maxLength={5000}
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="What's good, what to work on, and the drill to do it."
        className={textareaClass}
      />
      <p className="text-xs text-zinc-500">
        The player sees your drawings, notes, breakdown, and this feedback once you send it.
      </p>
      {error ? <Alert>{error}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await sendReview(video.id, summary);
              if (res.error) setError(res.error);
              else router.refresh();
            })
          }
        >
          {pending ? "Saving…" : reviewed ? "Update review" : "Send review to player"}
        </Button>
        {reviewed ? (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await reopenReview(video.id);
                if (res.error) setError(res.error);
                else router.refresh();
              })
            }
          >
            Move back to Needs review
          </Button>
        ) : null}
      </div>
      {reviewed && video.reviewedAt ? (
        <p className="text-xs text-zinc-500">
          Sent {fmtDate(video.reviewedAt)}
          {video.reviewerName ? ` by ${video.reviewerName}` : ""}.
        </p>
      ) : null}
    </section>
  );
}

function PlayerFeedback({ video }: { video: VideoDetail }) {
  if (video.status !== "reviewed") {
    return (
      <section className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
        <p className="font-semibold">⏳ Waiting for your coach</p>
        <p className="mt-1">
          You&apos;ll see their drawings, notes, and feedback here once they review it.
        </p>
      </section>
    );
  }
  return (
    <section className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-zinc-200">
      <div>
        <h2 className="font-semibold">Coach feedback</h2>
        <p className="text-xs text-zinc-500">
          {video.reviewerName ?? "Your coach"}
          {video.reviewedAt ? ` · ${fmtDate(video.reviewedAt)}` : ""}
        </p>
      </div>
      {video.reviewSummary ? (
        <p className="whitespace-pre-wrap text-sm text-zinc-800">{video.reviewSummary}</p>
      ) : (
        <p className="text-sm text-zinc-600">See the drawings and notes on the video.</p>
      )}
      {video.aiSummary ? (
        <div className="rounded-lg bg-zinc-50 p-3 text-sm ring-1 ring-zinc-200">
          <p className="font-semibold">AI-assisted notes</p>
          <p className="mb-2 text-xs text-zinc-500">Reviewed and shared by your coach.</p>
          <p className="whitespace-pre-wrap text-zinc-800">{video.aiSummary}</p>
        </div>
      ) : null}
    </section>
  );
}

export function StatusBadge({ status }: { status: VideoDetail["status"] }) {
  return status === "reviewed" ? (
    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-800 ring-1 ring-brand-200">
      ✓ Reviewed
    </span>
  ) : (
    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
      ● Needs review
    </span>
  );
}

function AiPanel({
  video,
  enabled,
  time,
  duration,
  onSeek,
}: {
  video: VideoDetail;
  enabled: boolean;
  time: number;
  duration: number;
  onSeek: (t: number) => void;
}) {
  const router = useRouter();
  const [range, setRange] = useState<{ start: number; end: number | null }>({
    start: 0,
    end: null,
  });
  const [count, setCount] = useState(8);
  const [focus, setFocus] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<AiDraft[]>(video.aiDrafts);
  const [editing, setEditing] = useState<string | null>(null);
  const end = range.end ?? duration;

  async function analyze() {
    if (!video.url) return;
    setError(null);
    setBusy("Grabbing frames…");
    try {
      const frames = await extractFrames(video.url, sampleTimes(range.start, end, count));
      setBusy("Analyzing… this can take up to a minute.");
      const res = await fetch(`/api/videos/${video.id}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames, focus }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          json.error ??
            (res.status === 504
              ? "The analysis ran past the server's time limit. Try fewer frames."
              : res.status === 413
                ? "Too much image data. Try fewer frames."
                : `The AI analysis failed (error ${res.status}).`),
        );
      }
      setDrafts((d) => [
        { id: json.id, createdAt: json.createdAt, model: json.model, analysis: json.analysis },
        ...d,
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The AI analysis failed.");
    } finally {
      setBusy(null);
    }
  }

  async function share(text: string | null) {
    setError(null);
    setBusy("Saving…");
    const res = await shareAiSummary(video.id, text);
    setBusy(null);
    if (res.error) return setError(res.error);
    setEditing(null);
    router.refresh();
  }

  async function discard(id: string) {
    setDrafts((d) => d.filter((x) => x.id !== id));
    const res = await deleteAiDraft(id);
    if (res.error) setError(res.error);
  }

  return (
    <section className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-zinc-200">
      <div>
        <h2 className="font-semibold">AI analysis</h2>
        <p className="mt-1 text-xs text-zinc-500">
          {AI_NOTE} Nothing reaches the player unless you share it.
        </p>
      </div>

      {!enabled ? (
        <p className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700 ring-1 ring-zinc-200">
          AI analysis is off. To turn it on, add an <code>ANTHROPIC_API_KEY</code> environment
          variable in Vercel (see docs/DEPLOY.md).
        </p>
      ) : (
        <div className="space-y-3">
          <div className="text-sm">
            <p className="font-medium text-zinc-800">
              Window: {formatClock(range.start)} – {formatClock(end)}
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                className="h-9 px-3"
                onClick={() =>
                  setRange((r) => ({
                    start: time,
                    end: r.end != null && r.end > time ? r.end : null,
                  }))
                }
              >
                Start here
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="h-9 px-3"
                onClick={() =>
                  setRange((r) => ({ start: r.start < time ? r.start : 0, end: time }))
                }
              >
                End here
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-9 px-3"
                onClick={() => setRange({ start: 0, end: null })}
              >
                Whole clip
              </Button>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Narrow the window to the rep (e.g. load to follow-through) so frames land on the key
              moments.
            </p>
          </div>
          <label className="block text-sm">
            <span className="font-medium text-zinc-800">Frames</span>
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="ml-2 h-9 rounded-md border-0 px-2 ring-1 ring-inset ring-zinc-300"
            >
              {[6, 8, 10, 12].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <input
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            maxLength={300}
            aria-label="What should the AI focus on?"
            placeholder="Focus (optional), e.g. hip-shoulder separation"
            className="h-11 w-full rounded-lg border-0 px-3 text-base ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-brand-600 sm:text-sm"
          />
          <Button
            type="button"
            onClick={analyze}
            disabled={!!busy || !video.url}
            className="w-full"
          >
            {busy ?? "Analyze with AI"}
          </Button>
        </div>
      )}

      {error ? <Alert>{error}</Alert> : null}

      {video.aiSummary && editing !== "shared" ? (
        <div className="space-y-2 rounded-lg bg-brand-50 p-3 text-sm ring-1 ring-brand-200">
          <p className="font-semibold text-brand-900">Shared with the player</p>
          <p className="whitespace-pre-wrap text-zinc-800">{video.aiSummary}</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="h-9 px-3"
              onClick={() => setEditing("shared")}
            >
              Edit
            </Button>
            <Button type="button" variant="ghost" className="h-9 px-3" onClick={() => share(null)}>
              Stop sharing
            </Button>
          </div>
        </div>
      ) : null}
      {editing === "shared" ? (
        <ShareEditor
          initial={video.aiSummary ?? ""}
          busy={!!busy}
          onCancel={() => setEditing(null)}
          onShare={share}
        />
      ) : null}

      {drafts.map((d) => (
        <AiDraftCard
          key={d.id}
          draft={d}
          editing={editing === d.id}
          busy={!!busy}
          onSeek={onSeek}
          onEdit={() => setEditing(d.id)}
          onCancel={() => setEditing(null)}
          onShare={share}
          onDiscard={() => discard(d.id)}
        />
      ))}
    </section>
  );
}

function ShareEditor({
  initial,
  busy,
  onShare,
  onCancel,
}: {
  initial: string;
  busy: boolean;
  onShare: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial);
  return (
    <div className="space-y-2">
      <textarea
        aria-label="AI notes to share"
        rows={10}
        maxLength={8000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className={textareaClass}
      />
      <p className="text-xs text-zinc-500">Edit anything that&apos;s off before sharing.</p>
      <div className="flex gap-2">
        <Button type="button" disabled={busy || !text.trim()} onClick={() => onShare(text)}>
          Share with player
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function AiDraftCard({
  draft,
  editing,
  busy,
  onSeek,
  onEdit,
  onCancel,
  onShare,
  onDiscard,
}: {
  draft: AiDraft;
  editing: boolean;
  busy: boolean;
  onSeek: (t: number) => void;
  onEdit: () => void;
  onCancel: () => void;
  onShare: (text: string) => void;
  onDiscard: () => void;
}) {
  const a: VideoAnalysis = draft.analysis;
  if (editing) {
    return (
      <ShareEditor initial={analysisToText(a)} busy={busy} onCancel={onCancel} onShare={onShare} />
    );
  }
  return (
    <article className="space-y-2 rounded-lg p-3 text-sm ring-1 ring-zinc-200">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          AI draft · {fmtDate(draft.createdAt)}
        </p>
        <span className="text-xs text-zinc-500">Confidence: {a.confidence}</span>
      </div>
      <p className="text-zinc-800">{a.summary}</p>
      {a.phases.length ? (
        <ol className="space-y-1">
          {a.phases.map((p, i) => (
            <li key={i} className="flex gap-2">
              <button
                type="button"
                onClick={() => onSeek(p.time_s)}
                className="h-6 shrink-0 rounded bg-zinc-100 px-1.5 font-mono text-xs tabular-nums hover:bg-zinc-200"
              >
                {formatClock(p.time_s)}
              </button>
              <span>
                <strong>{p.name}:</strong> {p.notes}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
      {a.strengths.length ? (
        <div>
          <p className="font-semibold">What&apos;s working</p>
          <ul className="list-disc pl-5">
            {a.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {a.improvements.length ? (
        <div>
          <p className="font-semibold">Work on</p>
          <ol className="list-decimal space-y-1 pl-5">
            {a.improvements.map((i, n) => (
              <li key={n}>
                <strong>{i.title}.</strong> {i.detail}
                {i.cue ? (
                  <span className="block text-zinc-600">Cue: &ldquo;{i.cue}&rdquo;</span>
                ) : null}
                {i.drill ? <span className="block text-zinc-600">Drill: {i.drill}</span> : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {a.limitations ? <p className="text-xs text-zinc-500">Limits: {a.limitations}</p> : null}
      <div className="flex gap-2 pt-1">
        <Button type="button" className="h-9 px-3" onClick={onEdit} disabled={busy}>
          Edit &amp; share
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-9 px-3"
          onClick={onDiscard}
          disabled={busy}
        >
          Discard
        </Button>
      </div>
    </article>
  );
}

function RemoveBreakdown({ videoId }: { videoId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this breakdown recording?")) return;
        start(async () => {
          await saveBreakdown(videoId, null);
          router.refresh();
        });
      }}
    >
      Delete breakdown
    </Button>
  );
}

function DeleteVideo({ videoId, backHref }: { videoId: string; backHref: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="ghost"
        className="text-red-700 hover:bg-red-50"
        disabled={pending}
        onClick={() => {
          if (!confirm("Delete this video and all its feedback? This can't be undone.")) return;
          start(async () => {
            const res = await deleteVideo(videoId);
            if (res.error) setError(res.error);
            else router.push(backHref);
          });
        }}
      >
        {pending ? "Deleting…" : "Delete video"}
      </Button>
      {error ? <Alert>{error}</Alert> : null}
    </div>
  );
}
