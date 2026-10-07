"use client";

import { createClient } from "@/lib/supabase/client";
import { MAX_VIDEO_BYTES, VIDEO_MIME_BY_EXT } from "@/constants/video";

const BUCKET = "videos";

export function videoMime(file: File): { mime: string; ext: string } | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (VIDEO_MIME_BY_EXT[ext]) return { mime: VIDEO_MIME_BY_EXT[ext], ext };
  const byType = Object.entries(VIDEO_MIME_BY_EXT).find(([, m]) => m === file.type);
  return byType ? { mime: byType[1], ext: byType[0] } : null;
}

export function checkVideoFile(file: File): string | null {
  if (!videoMime(file)) return "Use an MP4, MOV, or WebM video.";
  if (file.size > MAX_VIDEO_BYTES) {
    return `That video is ${(file.size / 1048576).toFixed(0)} MB. The limit is 50 MB: trim it to the rep you want reviewed (about 20 seconds of 1080p).`;
  }
  return null;
}

/** Uploads to the private videos bucket with progress (supabase-js has no progress events). */
export async function uploadFile(
  path: string,
  body: Blob,
  contentType: string,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session expired. Sign in again.");
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${BUCKET}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", "max-age=3600");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let msg = `Upload failed (${xhr.status}).`;
      try {
        const j = JSON.parse(xhr.responseText);
        if (j.message) msg = `Upload failed: ${j.message}`;
      } catch {}
      reject(new Error(msg));
    };
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
    xhr.send(body);
  });
}

export async function removeFiles(paths: string[]) {
  if (paths.length) await createClient().storage.from(BUCKET).remove(paths);
}

function loadVideo(src: string, crossOrigin: boolean): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    if (crossOrigin) v.crossOrigin = "anonymous";
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    const timer = setTimeout(() => reject(new Error("timeout")), 15000);
    v.onloadeddata = () => {
      clearTimeout(timer);
      resolve(v);
    };
    v.onerror = () => {
      clearTimeout(timer);
      reject(new Error("This browser can't read that video."));
    };
    v.src = src;
  });
}

function seek(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      v.removeEventListener("seeked", done);
      // Give the decoder a frame to paint.
      requestAnimationFrame(() => resolve());
    };
    v.addEventListener("seeked", done);
    v.currentTime = Math.min(Math.max(0, t), Math.max(0, (v.duration || 0) - 0.05));
  });
}

function grab(v: HTMLVideoElement, maxDim: number, quality: number): string {
  const scale = Math.min(1, maxDim / Math.max(v.videoWidth, v.videoHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(v.videoWidth * scale);
  c.height = Math.round(v.videoHeight * scale);
  c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", quality);
}

/** Duration and a JPEG thumbnail from a local file; nulls when the browser can't decode it. */
export async function probeFile(
  file: File,
): Promise<{ durationS: number | null; thumb: Blob | null }> {
  const url = URL.createObjectURL(file);
  try {
    const v = await loadVideo(url, false);
    const durationS = Number.isFinite(v.duration) ? v.duration : null;
    await seek(v, Math.min(1, (durationS ?? 0) * 0.25));
    const dataUrl = grab(v, 640, 0.8);
    const thumb = await (await fetch(dataUrl)).blob();
    return { durationS, thumb };
  } catch {
    return { durationS: null, thumb: null };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Still frames (base64 JPEG, no data: prefix) at the given times from a signed video URL. */
export async function extractFrames(
  src: string,
  times: number[],
): Promise<{ t: number; data: string }[]> {
  const v = await loadVideo(src, true);
  const out: { t: number; data: string }[] = [];
  for (const t of times) {
    await seek(v, t);
    out.push({ t, data: grab(v, 768, 0.75).split(",")[1] });
  }
  v.removeAttribute("src");
  v.load();
  return out;
}

export function pickRecorderMime(): string {
  const options = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4;codecs=avc1,mp4a.40.2",
    "video/mp4",
  ];
  if (typeof MediaRecorder === "undefined") return "";
  return options.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}
