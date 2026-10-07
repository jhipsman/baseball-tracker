import type { Enums } from "@/types/database";

export const VIDEO_TYPES: { key: Enums<"video_type">; label: string }[] = [
  { key: "hitting", label: "Hitting" },
  { key: "pitching", label: "Pitching" },
  { key: "fielding", label: "Fielding" },
  { key: "catching", label: "Catching" },
  { key: "exercise_form", label: "Exercise form" },
  { key: "other", label: "Other" },
];

export const VIDEO_TYPE_LABEL = Object.fromEntries(
  VIDEO_TYPES.map((t) => [t.key, t.label]),
) as Record<Enums<"video_type">, string>;

/** Matches the storage bucket limit (Supabase free plan maximum). */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

/** Upload types allowed by the bucket, keyed by file extension. */
export const VIDEO_MIME_BY_EXT: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  webm: "video/webm",
  "3gp": "video/3gpp",
};

export const ANNOTATION_COLORS = ["#facc15", "#ef4444", "#22d3ee", "#ffffff"] as const;

/** Seconds a drawing stays on screen after its timestamp while playing. */
export const ANNOTATION_HOLD_S = 1.5;

/** Longest narrated breakdown a coach can record. */
export const MAX_BREAKDOWN_S = 5 * 60;

export const AI_NOTE =
  "AI analysis is an assistant, not a replacement for a coach's eyes. It only sees a handful of still frames, so it can miss things or get them wrong.";
