"use server";

import { revalidatePath } from "next/cache";
import { requireActiveOrg } from "@/lib/org";
import { VIDEO_BUCKET } from "@/lib/videos";
import { VIDEO_TYPES } from "@/constants/video";
import { roundPts, type Pt } from "@/lib/video/geometry";
import type { Database, Enums, Json } from "@/types/database";

type Result<T = object> = ({ error: string } & Partial<T>) | ({ error?: undefined } & T);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS = new Set(["note", "line", "arrow", "angle", "circle", "freehand"]);
const text = (v: unknown, max: number) =>
  String(v ?? "")
    .trim()
    .slice(0, max);

function refresh(id?: string) {
  revalidatePath("/videos");
  revalidatePath("/player/videos");
  revalidatePath("/");
  if (id) {
    revalidatePath(`/videos/${id}`);
    revalidatePath(`/player/videos/${id}`);
  }
}

export type NewVideo = {
  id: string;
  playerId?: string;
  type: Enums<"video_type">;
  title: string;
  notes: string;
  path: string;
  thumbPath: string | null;
  mime: string;
  size: number;
  durationS: number | null;
};

/** Records a clip the browser already uploaded to {org}/{player}/{id}/. */
export async function createVideo(input: NewVideo): Promise<Result<{ id: string }>> {
  const { supabase, user, org, isStaff } = await requireActiveOrg();
  const playerId = isStaff && input.playerId ? input.playerId : user.id;
  if (!UUID.test(input.id)) return { error: "Invalid upload." };
  const prefix = `${org.id}/${playerId}/${input.id}/`;
  if (!input.path.startsWith(prefix) || input.path.includes(".."))
    return { error: "Invalid upload." };
  if (input.thumbPath && !input.thumbPath.startsWith(prefix)) return { error: "Invalid upload." };
  if (!VIDEO_TYPES.some((t) => t.key === input.type))
    return { error: "Choose what the video shows." };
  const title = text(input.title, 120);
  if (!title) return { error: "Give the video a title." };
  const duration = Number(input.durationS);

  const { error } = await supabase.from("videos").insert({
    id: input.id,
    org_id: org.id,
    player_id: playerId,
    uploaded_by: user.id,
    video_type: input.type,
    title,
    notes: text(input.notes, 2000) || null,
    storage_path: input.path,
    thumb_path: input.thumbPath,
    mime_type: text(input.mime, 100) || null,
    size_bytes: Math.max(0, Math.round(Number(input.size) || 0)),
    duration_s: Number.isFinite(duration) && duration > 0 ? Math.min(duration, 99999) : null,
  });
  if (error) return { error: error.message };
  refresh();
  return { id: input.id };
}

async function removeFolder(
  supabase: Awaited<ReturnType<typeof requireActiveOrg>>["supabase"],
  storagePath: string,
) {
  const folder = storagePath.split("/").slice(0, 3).join("/");
  const { data } = await supabase.storage.from(VIDEO_BUCKET).list(folder, { limit: 100 });
  const files = (data ?? []).map((f) => `${folder}/${f.name}`);
  if (files.length) await supabase.storage.from(VIDEO_BUCKET).remove(files);
}

export async function deleteVideo(id: string): Promise<Result> {
  const { supabase } = await requireActiveOrg();
  const { data: v } = await supabase
    .from("videos")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!v) return { error: "Video not found." };
  const { data: gone, error } = await supabase.from("videos").delete().eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!gone?.length) return { error: "You can't delete this video." };
  await removeFolder(supabase, v.storage_path);
  refresh(id);
  return {};
}

function cleanShape(kind: string, raw: unknown): Json | null {
  if (kind === "note") return null;
  const s = (raw ?? {}) as { points?: unknown; center?: unknown; radius?: unknown };
  const pt = (p: unknown): Pt | null =>
    Array.isArray(p) && p.length === 2 && p.every((n) => Number.isFinite(Number(n)))
      ? [Number(p[0]), Number(p[1])]
      : null;
  if (kind === "circle") {
    const c = pt(s.center);
    const r = Number(s.radius);
    if (!c || !Number.isFinite(r) || r <= 0) return null;
    return { center: roundPts([c])[0], radius: Math.min(1, Math.round(r * 1e4) / 1e4) };
  }
  const pts = (Array.isArray(s.points) ? s.points : []).slice(0, 600).map(pt);
  if (pts.some((p) => !p)) return null;
  const need = kind === "angle" ? 3 : 2;
  if (pts.length < need || (kind !== "freehand" && pts.length !== need)) return null;
  return { points: roundPts(pts as Pt[]) };
}

export type AnnotationInput = {
  t: number;
  kind: Enums<"annotation_kind">;
  shape: unknown;
  color: string | null;
  comment: string;
};

export async function addAnnotation(
  videoId: string,
  input: AnnotationInput,
): Promise<Result<{ id: string }>> {
  const { supabase, user } = await requireActiveOrg();
  if (!KINDS.has(input.kind)) return { error: "Unknown drawing." };
  const shape = cleanShape(input.kind, input.shape);
  if (input.kind !== "note" && !shape) return { error: "That drawing is incomplete." };
  const comment = text(input.comment, 1000);
  if (input.kind === "note" && !comment) return { error: "Type a note first." };
  const t = Number(input.t);
  const color = input.color && /^#[0-9a-f]{6}$/i.test(input.color) ? input.color : null;
  const { data, error } = await supabase
    .from("video_annotations")
    .insert({
      video_id: videoId,
      author_id: user.id,
      t_seconds: Number.isFinite(t) ? Math.max(0, Math.round(t * 100) / 100) : 0,
      kind: input.kind,
      shape,
      color,
      comment: comment || null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { id: data.id };
}

export async function updateAnnotationComment(id: string, comment: string): Promise<Result> {
  const { supabase } = await requireActiveOrg();
  const { error } = await supabase
    .from("video_annotations")
    .update({ comment: text(comment, 1000) || null })
    .eq("id", id)
    .neq("kind", "note");
  return error ? { error: error.message } : {};
}

export async function deleteAnnotation(id: string): Promise<Result> {
  const { supabase } = await requireActiveOrg();
  const { error } = await supabase.from("video_annotations").delete().eq("id", id);
  return error ? { error: error.message } : {};
}

async function updateVideo(
  videoId: string,
  patch: Database["public"]["Tables"]["videos"]["Update"],
): Promise<Result> {
  const { supabase, isStaff } = await requireActiveOrg();
  if (!isStaff) return { error: "Only coaches can review videos." };
  const { data, error } = await supabase
    .from("videos")
    .update(patch)
    .eq("id", videoId)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Video not found." };
  refresh(videoId);
  return {};
}

export async function sendReview(videoId: string, summary: string): Promise<Result> {
  const { user } = await requireActiveOrg();
  return updateVideo(videoId, {
    status: "reviewed",
    review_summary: text(summary, 5000) || null,
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
  });
}

export async function reopenReview(videoId: string): Promise<Result> {
  return updateVideo(videoId, { status: "pending" });
}

export async function shareAiSummary(videoId: string, summary: string | null): Promise<Result> {
  return updateVideo(videoId, { ai_summary: summary ? text(summary, 8000) || null : null });
}

/** Attaches an uploaded narrated breakdown, replacing (and deleting) the previous one. */
export async function saveBreakdown(videoId: string, path: string | null): Promise<Result> {
  const { supabase, isStaff } = await requireActiveOrg();
  if (!isStaff) return { error: "Only coaches can record breakdowns." };
  const { data: v } = await supabase
    .from("videos")
    .select("storage_path, breakdown_path")
    .eq("id", videoId)
    .maybeSingle();
  if (!v) return { error: "Video not found." };
  const folder = v.storage_path.split("/").slice(0, 3).join("/") + "/";
  if (path && (!path.startsWith(folder) || path.includes("..")))
    return { error: "Invalid upload." };
  const res = await updateVideo(videoId, { breakdown_path: path });
  if (!res.error && v.breakdown_path && v.breakdown_path !== path) {
    await supabase.storage.from(VIDEO_BUCKET).remove([v.breakdown_path]);
  }
  return res;
}

export async function deleteAiDraft(id: string): Promise<Result> {
  const { supabase } = await requireActiveOrg();
  const { error } = await supabase.from("video_ai_analyses").delete().eq("id", id);
  return error ? { error: error.message } : {};
}
