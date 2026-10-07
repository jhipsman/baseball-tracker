import { NextResponse } from "next/server";
import { requireActiveOrg } from "@/lib/org";
import { aiEnabled } from "@/lib/videos";
import { AnalysisError, analyzeFrames, type Frame } from "@/lib/video/ai";

// Vision analysis with thinking can take a minute.
export const maxDuration = 120;

const MAX_FRAMES = 12;
const MAX_FRAME_CHARS = 400_000; // ~300 KB JPEG as base64

export async function POST(request: Request, ctx: RouteContext<"/api/videos/[id]/analyze">) {
  const { id } = await ctx.params;
  const { supabase, user, isStaff } = await requireActiveOrg();
  if (!isStaff)
    return NextResponse.json({ error: "Only coaches can run AI analysis." }, { status: 403 });
  if (!aiEnabled()) {
    return NextResponse.json({ error: "AI analysis isn't set up yet." }, { status: 503 });
  }

  const { data: video } = await supabase
    .from("videos")
    .select("id, title, video_type, notes")
    .eq("id", id)
    .maybeSingle();
  if (!video) return NextResponse.json({ error: "Video not found." }, { status: 404 });

  let body: { frames?: unknown; focus?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const frames: Frame[] = (Array.isArray(body.frames) ? body.frames : [])
    .slice(0, MAX_FRAMES)
    .flatMap((f: { t?: unknown; data?: unknown }) => {
      const t = Number(f?.t);
      const data =
        typeof f?.data === "string" ? f.data.replace(/^data:image\/jpeg;base64,/, "") : "";
      return Number.isFinite(t) &&
        data &&
        data.length <= MAX_FRAME_CHARS &&
        /^[A-Za-z0-9+/=]+$/.test(data)
        ? [{ t, data }]
        : [];
    });
  if (frames.length < 2) {
    return NextResponse.json({ error: "Couldn't read frames from this video." }, { status: 400 });
  }

  try {
    const { analysis, model } = await analyzeFrames({
      frames,
      videoType: video.video_type,
      title: video.title,
      playerNotes: video.notes,
      focus: String(body.focus ?? "")
        .trim()
        .slice(0, 300),
    });
    const { data: saved, error } = await supabase
      .from("video_ai_analyses")
      .insert({ video_id: id, created_by: user.id, model, result: analysis })
      .select("id, created_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ id: saved.id, createdAt: saved.created_at, model, analysis });
  } catch (e) {
    if (e instanceof AnalysisError) return NextResponse.json({ error: e.message }, { status: 502 });
    console.error(e);
    return NextResponse.json({ error: "The AI analysis failed. Try again." }, { status: 500 });
  }
}
