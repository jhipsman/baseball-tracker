import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums, Json } from "@/types/database";
import { parseAnalysis, type VideoAnalysis } from "@/lib/video/analysis";

type Client = SupabaseClient<Database>;

export const VIDEO_BUCKET = "videos";
const URL_TTL_S = 60 * 60 * 3;

export type VideoListItem = {
  id: string;
  title: string;
  type: Enums<"video_type">;
  status: Enums<"video_status">;
  playerId: string;
  playerName: string;
  createdAt: string;
  durationS: number | null;
  thumbUrl: string | null;
  hasBreakdown: boolean;
};

const nameOf = (p: { full_name: string | null; email: string } | null) =>
  p?.full_name || p?.email || "Player";

/** Signed URLs for private storage paths (missing/failed paths map to null). */
export async function signedUrls(supabase: Client, paths: (string | null)[]) {
  const wanted = [...new Set(paths.filter((p): p is string => !!p))];
  const out = new Map<string, string>();
  if (wanted.length === 0) return out;
  const { data } = await supabase.storage.from(VIDEO_BUCKET).createSignedUrls(wanted, URL_TTL_S);
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) out.set(row.path, row.signedUrl);
  }
  return out;
}

export async function loadVideos(
  supabase: Client,
  orgId: string,
  opts: { playerId?: string; status?: Enums<"video_status">; limit?: number } = {},
): Promise<VideoListItem[]> {
  let q = supabase
    .from("videos")
    .select(
      "id, title, video_type, status, player_id, created_at, duration_s, thumb_path, breakdown_path, player:profiles!videos_player_id_fkey (full_name, email)",
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 120);
  if (opts.playerId) q = q.eq("player_id", opts.playerId);
  if (opts.status) q = q.eq("status", opts.status);
  const { data } = await q;
  const rows = data ?? [];
  const urls = await signedUrls(
    supabase,
    rows.map((r) => r.thumb_path),
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    type: r.video_type,
    status: r.status,
    playerId: r.player_id,
    playerName: nameOf(r.player),
    createdAt: r.created_at,
    durationS: r.duration_s,
    thumbUrl: r.thumb_path ? (urls.get(r.thumb_path) ?? null) : null,
    hasBreakdown: !!r.breakdown_path,
  }));
}

export type Annotation = {
  id: string;
  t: number;
  kind: Enums<"annotation_kind">;
  shape: { points?: [number, number][]; center?: [number, number]; radius?: number } | null;
  color: string | null;
  comment: string | null;
};

export type AiDraft = { id: string; createdAt: string; model: string; analysis: VideoAnalysis };

export async function loadVideo(supabase: Client, id: string, isStaff: boolean) {
  const { data: v } = await supabase
    .from("videos")
    .select(
      "*, player:profiles!videos_player_id_fkey (full_name, email), reviewer:profiles!videos_reviewed_by_fkey (full_name, email)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!v) return null;

  const [{ data: ann }, drafts, urls] = await Promise.all([
    supabase
      .from("video_annotations")
      .select("id, t_seconds, kind, shape, color, comment")
      .eq("video_id", id)
      .order("t_seconds")
      .order("created_at"),
    isStaff
      ? supabase
          .from("video_ai_analyses")
          .select("id, created_at, model, result")
          .eq("video_id", id)
          .order("created_at", { ascending: false })
          .limit(5)
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
    signedUrls(supabase, [v.storage_path, v.breakdown_path]),
  ]);

  const annotations: Annotation[] = (ann ?? []).map((a) => ({
    id: a.id,
    t: Number(a.t_seconds),
    kind: a.kind,
    shape: a.shape as Annotation["shape"],
    color: a.color,
    comment: a.comment,
  }));
  const aiDrafts: AiDraft[] = drafts.flatMap((d) => {
    const analysis = parseAnalysis(d.result as Json);
    return analysis ? [{ id: d.id, createdAt: d.created_at, model: d.model, analysis }] : [];
  });

  return {
    id: v.id,
    orgId: v.org_id,
    playerId: v.player_id,
    playerName: nameOf(v.player),
    uploadedBy: v.uploaded_by,
    title: v.title,
    type: v.video_type,
    notes: v.notes,
    status: v.status,
    createdAt: v.created_at,
    durationS: v.duration_s,
    url: urls.get(v.storage_path) ?? null,
    breakdownUrl: v.breakdown_path ? (urls.get(v.breakdown_path) ?? null) : null,
    reviewSummary: v.review_summary,
    aiSummary: v.ai_summary,
    reviewerName: v.reviewer ? nameOf(v.reviewer) : null,
    reviewedAt: v.reviewed_at,
    annotations,
    aiDrafts,
  };
}

export type VideoDetail = NonNullable<Awaited<ReturnType<typeof loadVideo>>>;

export async function pendingVideoCount(supabase: Client, orgId: string) {
  const { count } = await supabase
    .from("videos")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "pending");
  return count ?? 0;
}

export const aiEnabled = () => !!process.env.ANTHROPIC_API_KEY;
