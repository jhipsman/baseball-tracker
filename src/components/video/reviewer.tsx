"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ANNOTATION_COLORS, ANNOTATION_HOLD_S, MAX_BREAKDOWN_S } from "@/constants/video";
import { angleAt, dist, formatClock, isVisibleAt, simplify, type Pt } from "@/lib/video/geometry";
import {
  addAnnotation,
  deleteAnnotation,
  saveBreakdown,
  updateAnnotationComment,
} from "@/lib/video-actions";
import type { Annotation } from "@/lib/videos";
import { pickRecorderMime, uploadFile } from "./media";

type Tool = "play" | "line" | "arrow" | "angle" | "circle" | "freehand";
type Draft = { kind: Tool; points: Pt[]; cursor?: Pt };

const TOOLS: { key: Tool; label: string; hint: string }[] = [
  { key: "play", label: "Watch", hint: "Tap the video to play or pause." },
  { key: "line", label: "Line", hint: "Drag to draw a line." },
  { key: "arrow", label: "Arrow", hint: "Drag to draw an arrow." },
  {
    key: "angle",
    label: "Angle",
    hint: "Tap three points: one end, the joint (vertex), then the other end.",
  },
  { key: "circle", label: "Circle", hint: "Drag from the center outward." },
  { key: "freehand", label: "Draw", hint: "Drag to draw freehand." },
];

const KIND_LABEL: Record<Annotation["kind"], string> = {
  note: "Note",
  line: "Line",
  arrow: "Arrow",
  angle: "Angle",
  circle: "Circle",
  freehand: "Drawing",
};

const FRAME = 1 / 30;
const SPEEDS = [0.25, 0.5, 1];

export type PlayerApi = { seek: (t: number) => void };

type Props = {
  video: { id: string; url: string; orgId: string; playerId: string };
  annotations: Annotation[];
  canEdit: boolean;
  onTime?: (t: number, duration: number) => void;
  apiRef?: React.RefObject<PlayerApi | null>;
  /** Rendered right under the transport controls (e.g. the player's feedback). */
  belowPlayer?: React.ReactNode;
};

function angleOf(a: Annotation | Draft, aspect: number): number | null {
  const pts = "shape" in a ? a.shape?.points : a.points;
  if (!pts || pts.length < 3) return null;
  return angleAt(pts[0], pts[1], pts[2], aspect);
}

function draw(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  items: Annotation[],
  draft: Draft | null,
  color: string,
) {
  const lw = Math.max(2.5, W / 260);
  const px = ([x, y]: Pt): Pt => [x * W, y * H];
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const stroke = (c: string, fn: () => void) => {
    ctx.save();
    ctx.strokeStyle = c;
    ctx.fillStyle = c;
    ctx.lineWidth = lw;
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = lw;
    fn();
    ctx.restore();
  };

  const shape = (
    kind: string,
    pts: Pt[],
    center: Pt | undefined,
    radius: number | undefined,
    c: string,
  ) =>
    stroke(c, () => {
      if (kind === "circle" && center && radius) {
        const [cx, cy] = px(center);
        ctx.beginPath();
        ctx.arc(cx, cy, radius * W, 0, Math.PI * 2);
        ctx.stroke();
        return;
      }
      if (pts.length < 2) {
        if (pts[0]) {
          const [x, y] = px(pts[0]);
          ctx.beginPath();
          ctx.arc(x, y, lw * 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        return;
      }
      const P = pts.map(px);
      ctx.beginPath();
      ctx.moveTo(P[0][0], P[0][1]);
      for (const p of P.slice(1)) ctx.lineTo(p[0], p[1]);
      ctx.stroke();
      if (kind === "arrow") {
        const [a, b] = [P[P.length - 2], P[P.length - 1]];
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        const s = lw * 5;
        ctx.beginPath();
        ctx.moveTo(b[0], b[1]);
        ctx.lineTo(b[0] - s * Math.cos(ang - 0.45), b[1] - s * Math.sin(ang - 0.45));
        ctx.lineTo(b[0] - s * Math.cos(ang + 0.45), b[1] - s * Math.sin(ang + 0.45));
        ctx.closePath();
        ctx.fill();
      }
      if (kind === "angle" && P.length >= 3) {
        const [a, v, c2] = P;
        const a1 = Math.atan2(a[1] - v[1], a[0] - v[0]);
        const a2 = Math.atan2(c2[1] - v[1], c2[0] - v[0]);
        let delta = a2 - a1;
        while (delta > Math.PI) delta -= 2 * Math.PI;
        while (delta < -Math.PI) delta += 2 * Math.PI;
        const r = Math.min(
          lw * 10,
          Math.hypot(a[0] - v[0], a[1] - v[1]) * 0.5,
          Math.hypot(c2[0] - v[0], c2[1] - v[1]) * 0.5,
        );
        ctx.beginPath();
        ctx.arc(v[0], v[1], r, a1, a1 + delta, delta < 0);
        ctx.stroke();
        const deg = angleAt(pts[0], pts[1], pts[2], W / H);
        const mid = a1 + delta / 2;
        const label = `${Math.round(deg)}°`;
        ctx.font = `600 ${Math.round(lw * 6)}px system-ui, sans-serif`;
        const tx = v[0] + Math.cos(mid) * (r + lw * 8);
        const ty = v[1] + Math.sin(mid) * (r + lw * 8);
        const w = ctx.measureText(label).width;
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(tx - w / 2 - lw, ty - lw * 4, w + lw * 2, lw * 8);
        ctx.fillStyle = c;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, tx, ty);
      }
    });

  for (const a of items) {
    if (a.kind === "note" || !a.shape) continue;
    shape(
      a.kind,
      a.shape.points ?? [],
      a.shape.center,
      a.shape.radius,
      a.color ?? ANNOTATION_COLORS[0],
    );
  }
  if (draft) {
    const pts = draft.cursor ? [...draft.points, draft.cursor] : draft.points;
    if (draft.kind === "circle" && pts.length >= 2) {
      shape("circle", [], pts[0], dist(pts[0], pts[pts.length - 1], W / H) / (W / H), color);
    } else {
      shape(draft.kind, pts, undefined, undefined, color);
    }
  }

  // Captions for comments on screen right now.
  const captions = items.map((a) => a.comment).filter(Boolean) as string[];
  if (captions.length) {
    const fs = Math.max(13, Math.round(W / 45));
    ctx.save();
    ctx.font = `500 ${fs}px system-ui, sans-serif`;
    ctx.textBaseline = "top";
    let y = H - fs * 1.6 * captions.length - fs * 0.6;
    for (const c of captions.slice(-3)) {
      const text = c.length > 90 ? `${c.slice(0, 88)}…` : c;
      const w = ctx.measureText(text).width;
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(fs * 0.5, y - fs * 0.25, w + fs, fs * 1.5);
      ctx.fillStyle = "#fff";
      ctx.fillText(text, fs, y);
      y += fs * 1.6;
    }
    ctx.restore();
  }
}

export function Reviewer({
  video,
  annotations: initial,
  canEdit,
  onTime,
  apiRef,
  belowPlayer,
}: Props) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [items, setItems] = useState<Annotation[]>(initial);
  const [tool, setTool] = useState<Tool>("play");
  const [color, setColor] = useState<string>(ANNOTATION_COLORS[0]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  // Recording state
  const [rec, setRec] = useState<{ start: number; elapsed: number } | null>(null);
  const [recording, setRecording] = useState<{ blob: Blob; url: string; mime: string } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const compositeRef = useRef<HTMLCanvasElement | null>(null);
  const micRef = useRef<MediaStream | null>(null);

  // Latest values for the render loop.
  const live = useRef({ items, draft, showAll, color, recording: false, onTime });
  useLayoutEffect(() => {
    live.current = { items, draft, showAll, color, recording: !!rec, onTime };
  });

  const seek = useCallback((t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = Math.min(Math.max(0, t), v.duration || t);
  }, []);
  useEffect(() => {
    if (apiRef) apiRef.current = { seek };
  }, [apiRef, seek]);

  // Render loop: overlay drawings (and the composite frame while recording).
  useEffect(() => {
    let raf = 0;
    let lastT = -1;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const v = videoRef.current;
      const c = overlayRef.current;
      if (!v || !c) return;
      const now = v.currentTime;
      if (Math.abs(now - lastT) >= 0.03) {
        lastT = now;
        setTime(now);
        live.current.onTime?.(now, v.duration || 0);
      }
      const rect = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const W = Math.max(1, Math.round(rect.width * dpr));
      const H = Math.max(1, Math.round(rect.height * dpr));
      if (c.width !== W || c.height !== H) {
        c.width = W;
        c.height = H;
      }
      const { items, draft, showAll, color } = live.current;
      const visible = showAll
        ? items
        : items.filter((a) => isVisibleAt(a.t, now, ANNOTATION_HOLD_S));
      const ctx = c.getContext("2d")!;
      ctx.clearRect(0, 0, W, H);
      draw(ctx, W, H, visible, draft, color);

      const comp = compositeRef.current;
      if (comp && live.current.recording) {
        const cx = comp.getContext("2d")!;
        cx.drawImage(v, 0, 0, comp.width, comp.height);
        cx.drawImage(c, 0, 0, comp.width, comp.height);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }, []);

  const step = useCallback((dir: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = Math.min(Math.max(0, v.currentTime + dir * FRAME), v.duration || 0);
  }, []);

  function onKey(e: React.KeyboardEvent) {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (e.key === " " || e.key === "k") {
      e.preventDefault();
      togglePlay();
    } else if (e.key === "ArrowLeft" || e.key === ",") {
      e.preventDefault();
      step(-1);
    } else if (e.key === "ArrowRight" || e.key === ".") {
      e.preventDefault();
      step(1);
    } else if (e.key === "Escape") {
      setDraft(null);
    }
  }

  const norm = (e: React.PointerEvent): Pt => {
    const r = overlayRef.current!.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    ];
  };

  async function commit(kind: Annotation["kind"], shape: Annotation["shape"], comment = "") {
    const v = videoRef.current;
    const t = Math.round((v?.currentTime ?? 0) * 100) / 100;
    const temp: Annotation = {
      id: `tmp-${Date.now()}`,
      t,
      kind,
      shape,
      color,
      comment: comment || null,
    };
    setItems((xs) => [...xs, temp].sort((a, b) => a.t - b.t));
    setError(null);
    const res = await addAnnotation(video.id, { t, kind, shape, color, comment });
    if (res.error || !res.id) {
      setItems((xs) => xs.filter((x) => x.id !== temp.id));
      setError(res.error ?? "Couldn't save that drawing.");
      return;
    }
    setItems((xs) => xs.map((x) => (x.id === temp.id ? { ...x, id: res.id! } : x)));
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!canEdit || tool === "play") {
      togglePlay();
      return;
    }
    videoRef.current?.pause();
    const p = norm(e);
    if (tool === "angle") {
      const pts = draft?.kind === "angle" ? [...draft.points, p] : [p];
      if (pts.length === 3) {
        setDraft(null);
        void commit("angle", { points: pts });
      } else {
        setDraft({ kind: "angle", points: pts, cursor: p });
      }
      return;
    }
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDraft({ kind: tool, points: [p] });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!draft) return;
    const p = norm(e);
    if (draft.kind === "angle") return setDraft({ ...draft, cursor: p });
    if (draft.kind === "freehand") return setDraft({ ...draft, points: [...draft.points, p] });
    setDraft({ ...draft, cursor: p });
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!draft || draft.kind === "angle") return;
    const end = draft.cursor ?? norm(e);
    const start = draft.points[0];
    const d = dists(start, end);
    setDraft(null);
    if (draft.kind === "freehand") {
      const pts = simplify([...draft.points, end]);
      if (pts.length >= 2) void commit("freehand", { points: pts });
      return;
    }
    if (d < 0.01) return;
    if (draft.kind === "circle") {
      const aspect = dims ? dims.w / dims.h : 1;
      void commit("circle", { center: start, radius: dist(start, end, aspect) / aspect });
    } else {
      void commit(draft.kind as "line" | "arrow", { points: [start, end] });
    }
  }

  async function remove(id: string) {
    const prev = items;
    setItems((xs) => xs.filter((x) => x.id !== id));
    const res = await deleteAnnotation(id);
    if (res.error) {
      setItems(prev);
      setError(res.error);
    }
  }

  async function saveComment(id: string, comment: string) {
    const current = items.find((x) => x.id === id);
    if (!current || (current.comment ?? "") === comment) return;
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, comment: comment || null } : x)));
    const res = await updateAnnotationComment(id, comment);
    if (res.error) setError(res.error);
  }

  function undo() {
    const last = items.filter((x) => !x.id.startsWith("tmp-")).at(-1);
    if (last) void remove(last.id);
  }

  // ---- Voice-over recording
  async function startRecording() {
    setError(null);
    const v = videoRef.current;
    const overlay = overlayRef.current;
    const mime = pickRecorderMime();
    if (!v || !overlay || !mime || !("captureStream" in HTMLCanvasElement.prototype)) {
      setError("This browser can't record a breakdown. Try Chrome, Edge, or Safari on a computer.");
      return;
    }
    let mic: MediaStream;
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Allow microphone access to record a voice-over.");
      return;
    }
    const scale = Math.min(1, 1280 / Math.max(v.videoWidth || 1280, v.videoHeight || 720));
    const comp = document.createElement("canvas");
    comp.width = Math.round((v.videoWidth || 1280) * scale);
    comp.height = Math.round((v.videoHeight || 720) * scale);
    compositeRef.current = comp;
    const stream = comp.captureStream(30);
    for (const t of mic.getAudioTracks()) stream.addTrack(t);
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_500_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      mic.getTracks().forEach((t) => t.stop());
      micRef.current = null;
      compositeRef.current = null;
      const type = mime.split(";")[0];
      const blob = new Blob(chunks, { type });
      setRecording({ blob, url: URL.createObjectURL(blob), mime: type });
      setRec(null);
    };
    micRef.current = mic;
    recorderRef.current = recorder;
    recorder.start(1000);
    setRec({ start: Date.now(), elapsed: 0 });
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  useEffect(() => {
    if (!rec) return;
    const id = setInterval(() => {
      const elapsed = (Date.now() - rec.start) / 1000;
      if (elapsed >= MAX_BREAKDOWN_S) stopRecording();
      setRec((r) => (r ? { ...r, elapsed } : r));
    }, 250);
    return () => clearInterval(id);
  }, [rec?.start]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => {
      micRef.current?.getTracks().forEach((t) => t.stop());
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    },
    [],
  );

  function discardRecording() {
    if (recording) URL.revokeObjectURL(recording.url);
    setRecording(null);
  }

  async function saveRecording() {
    if (!recording) return;
    setSaving(true);
    setError(null);
    const ext = recording.mime === "video/mp4" ? "mp4" : "webm";
    const path = `${video.orgId}/${video.playerId}/${video.id}/breakdown-${Date.now()}.${ext}`;
    try {
      await uploadFile(path, recording.blob, recording.mime);
      const res = await saveBreakdown(video.id, path);
      if (res.error) throw new Error(res.error);
      discardRecording();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the breakdown.");
    } finally {
      setSaving(false);
    }
  }

  const aspect = dims ? dims.w / dims.h : 16 / 9;
  const activeHint = TOOLS.find((t) => t.key === tool)?.hint;
  const sorted = items.toSorted((a, b) => a.t - b.t);

  return (
    <div className="space-y-3" onKeyDown={onKey}>
      <div
        className="relative mx-auto overflow-hidden rounded-xl bg-black"
        style={{ aspectRatio: `${aspect}`, width: `min(100%, calc(70vh * ${aspect}))` }}
      >
        <video
          ref={videoRef}
          src={video.url}
          crossOrigin="anonymous"
          playsInline
          muted
          preload="auto"
          className="absolute inset-0 size-full"
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            setDims({ w: v.videoWidth || 16, h: v.videoHeight || 9 });
            setDuration(v.duration || 0);
            onTime?.(v.currentTime, v.duration || 0);
          }}
          onError={() => setLoadError(true)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
        <canvas
          ref={overlayRef}
          tabIndex={0}
          role="img"
          aria-label="Video with drawings. Space plays or pauses; arrow keys step one frame."
          className={cn(
            "absolute inset-0 size-full outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
            canEdit && tool !== "play" ? "cursor-crosshair touch-none" : "cursor-pointer",
          )}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
        {loadError ? (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white">
            This browser can&apos;t play this video. Try Safari, or on iPhone set Settings → Camera
            → Formats → Most Compatible before recording.
          </div>
        ) : null}
        {rec ? (
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white">
            <span className="size-2 animate-pulse rounded-full bg-white" />
            REC {formatClock(rec.elapsed).split(".")[0]}
          </div>
        ) : null}
      </div>

      {/* Transport */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          className="w-24"
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? "❚❚ Pause" : "▶ Play"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => step(-1)}
          aria-label="Back one frame"
        >
          ◀︎ Frame
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => step(1)}
          aria-label="Forward one frame"
        >
          Frame ▶︎
        </Button>
        <div className="flex rounded-lg ring-1 ring-zinc-300" role="group" aria-label="Speed">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={rate === s}
              onClick={() => {
                setRate(s);
                if (videoRef.current) videoRef.current.playbackRate = s;
              }}
              className={cn(
                "h-11 px-3 text-sm font-semibold first:rounded-l-lg last:rounded-r-lg",
                rate === s ? "bg-zinc-900 text-white" : "bg-white text-zinc-700",
              )}
            >
              {s === 1 ? "1×" : s === 0.5 ? "½×" : "¼×"}
            </button>
          ))}
        </div>
        <span className="ml-auto font-mono text-sm tabular-nums text-zinc-700" aria-live="off">
          {formatClock(time)} / {formatClock(duration)}
        </span>
      </div>
      <input
        type="range"
        aria-label="Scrub"
        min={0}
        max={duration || 0}
        step={0.01}
        value={Math.min(time, duration || 0)}
        onChange={(e) => seek(Number(e.target.value))}
        className="w-full accent-brand-700"
      />
      <div className="relative -mt-2 h-3" aria-hidden>
        {duration > 0
          ? sorted.map((a) => (
              <span
                key={a.id}
                className="absolute top-0 h-3 w-1 -translate-x-1/2 rounded bg-amber-500"
                style={{ left: `${(a.t / duration) * 100}%` }}
              />
            ))
          : null}
      </div>

      {belowPlayer}

      {canEdit ? (
        <div className="space-y-2 rounded-xl bg-white p-3 ring-1 ring-zinc-200">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1" role="group" aria-label="Drawing tool">
              {TOOLS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  aria-pressed={tool === t.key}
                  onClick={() => {
                    setTool(t.key);
                    setDraft(null);
                  }}
                  className={cn(
                    "h-10 rounded-lg px-3 text-sm font-semibold",
                    tool === t.key ? "bg-brand-700 text-white" : "bg-zinc-100 text-zinc-800",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1" role="group" aria-label="Color">
              {ANNOTATION_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  aria-pressed={color === c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "size-8 rounded-full ring-1 ring-zinc-300",
                    color === c && "ring-2 ring-zinc-900 ring-offset-2",
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
            <Button type="button" variant="ghost" onClick={undo} disabled={!items.length}>
              Undo
            </Button>
            <label className="ml-auto flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="size-4 accent-brand-700"
              />
              Show all drawings
            </label>
          </div>
          <p className="text-xs text-zinc-500">
            {activeHint} Drawings appear at the frame where you draw them.
          </p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!note.trim()) return;
              videoRef.current?.pause();
              void commit("note", null, note.trim());
              setNote("");
            }}
          >
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              aria-label="Note at this moment"
              placeholder={`Note at ${formatClock(time)}…`}
              className="h-11 min-w-0 flex-1 rounded-lg border-0 px-3 text-base ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-brand-600 sm:text-sm"
            />
            <Button type="submit" variant="secondary" disabled={!note.trim()}>
              Add note
            </Button>
          </form>
        </div>
      ) : (
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
            className="size-4 accent-brand-700"
          />
          Show all drawings
        </label>
      )}

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {canEdit ? (
        <section className="space-y-2 rounded-xl bg-white p-3 ring-1 ring-zinc-200">
          <h3 className="text-sm font-semibold">Voice-over breakdown</h3>
          <p className="text-xs text-zinc-500">
            Records the video, your drawings, and your voice while you play, pause, step, and draw.
            Up to {MAX_BREAKDOWN_S / 60} minutes.
          </p>
          {recording ? (
            <div className="space-y-2">
              <video
                src={recording.url}
                controls
                playsInline
                className="max-h-64 rounded-lg bg-black"
              />
              <div className="flex gap-2">
                <Button type="button" onClick={saveRecording} disabled={saving}>
                  {saving ? "Saving…" : "Save breakdown"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={discardRecording}
                  disabled={saving}
                >
                  Discard
                </Button>
              </div>
            </div>
          ) : rec ? (
            <Button type="button" className="bg-red-600 hover:bg-red-500" onClick={stopRecording}>
              ■ Stop recording
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={startRecording} disabled={loadError}>
              ● Record voice-over
            </Button>
          )}
        </section>
      ) : null}

      <section aria-label="Drawings and notes">
        <h3 className="mb-2 text-sm font-semibold">
          Drawings &amp; notes <span className="font-normal text-zinc-500">({sorted.length})</span>
        </h3>
        {sorted.length === 0 ? (
          <p className="text-sm text-zinc-500">
            {canEdit ? "Pause on a frame and pick a tool to start." : "None yet."}
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-xl bg-white ring-1 ring-zinc-200">
            {sorted.map((a) => {
              const deg = a.kind === "angle" ? angleOf(a, aspect) : null;
              return (
                <li key={a.id} className="flex items-start gap-3 p-3">
                  <button
                    type="button"
                    onClick={() => seek(a.t)}
                    className="shrink-0 rounded-md bg-zinc-100 px-2 py-1 font-mono text-xs tabular-nums text-zinc-800 hover:bg-zinc-200"
                    aria-label={`Go to ${formatClock(a.t)}`}
                  >
                    {formatClock(a.t)}
                  </button>
                  <span
                    className="mt-1.5 size-3 shrink-0 rounded-full ring-1 ring-zinc-300"
                    style={{
                      background:
                        a.kind === "note" ? "transparent" : (a.color ?? ANNOTATION_COLORS[0]),
                    }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium text-zinc-900">
                      {KIND_LABEL[a.kind]}
                      {deg != null ? ` · ${Math.round(deg)}°` : ""}
                    </p>
                    {canEdit && a.kind !== "note" ? (
                      <input
                        defaultValue={a.comment ?? ""}
                        key={`${a.id}-${a.comment ?? ""}`}
                        maxLength={1000}
                        placeholder="Add a comment (optional)"
                        aria-label={`Comment for ${KIND_LABEL[a.kind]} at ${formatClock(a.t)}`}
                        disabled={a.id.startsWith("tmp-")}
                        onBlur={(e) => saveComment(a.id, e.target.value.trim())}
                        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                        className="mt-1 h-9 w-full rounded-md border-0 px-2 text-sm ring-1 ring-inset ring-zinc-200 focus:ring-2 focus:ring-brand-600"
                      />
                    ) : a.comment ? (
                      <p className="mt-0.5 whitespace-pre-wrap text-zinc-700">{a.comment}</p>
                    ) : null}
                  </div>
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => remove(a.id)}
                      disabled={a.id.startsWith("tmp-")}
                      className="shrink-0 rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-red-50 hover:text-red-700"
                      aria-label={`Delete ${KIND_LABEL[a.kind]} at ${formatClock(a.t)}`}
                    >
                      Delete
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function dists(a: Pt, b: Pt) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}
