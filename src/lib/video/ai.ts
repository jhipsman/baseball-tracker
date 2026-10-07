import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { ANALYSIS_SCHEMA, parseAnalysis, type VideoAnalysis } from "@/lib/video/analysis";
import { VIDEO_TYPE_LABEL } from "@/constants/video";
import type { Enums } from "@/types/database";

export const AI_MODEL = "claude-opus-5-5";

export type Frame = { t: number; data: string };

const SYSTEM = `You are an experienced baseball and softball coach and strength coach reviewing a player's video for their coach.
You receive still frames taken in order from one clip, each labeled with its timestamp.
Describe only what is visible in the frames. When something can't be judged from these frames (camera angle, blur, a phase between frames), say so instead of guessing.
Write for a coach who will edit your notes before sharing them with the player, who may be a teenager: plain language, specific, encouraging, no medical diagnoses.
Give at most three improvements, most important first, each with a short cue and one drill.`;

export class AnalysisError extends Error {}

export async function analyzeFrames(args: {
  frames: Frame[];
  videoType: Enums<"video_type">;
  title: string;
  playerNotes: string | null;
  focus: string;
}): Promise<{ analysis: VideoAnalysis; model: string }> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const [i, f] of args.frames.entries()) {
    content.push({ type: "text", text: `Frame ${i + 1} at ${f.t.toFixed(2)}s` });
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: f.data },
    });
  }
  const context = [
    `Clip type: ${VIDEO_TYPE_LABEL[args.videoType]}.`,
    `Title: ${args.title}.`,
    args.playerNotes ? `Player's note: ${args.playerNotes}` : "",
    args.focus ? `The coach wants you to focus on: ${args.focus}` : "",
    "Analyze the mechanics shown in these frames.",
  ]
    .filter(Boolean)
    .join("\n");
  content.push({ type: "text", text: context });

  let message: Anthropic.Beta.BetaMessage;
  try {
    message = await client.beta.messages
      .stream({
        model: AI_MODEL,
        max_tokens: 8000,
        thinking: { type: "adaptive" },
        output_config: {
          effort: "medium",
          format: { type: "json_schema", schema: ANALYSIS_SCHEMA },
        },
        // If the model declines, the API retries on Anthropic's recommended fallback model.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: SYSTEM,
        messages: [{ role: "user", content }],
      })
      .finalMessage();
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      throw new AnalysisError("The AI key isn't valid. Check ANTHROPIC_API_KEY.");
    }
    if (e instanceof Anthropic.RateLimitError) {
      throw new AnalysisError("The AI service is busy. Try again in a minute.");
    }
    if (e instanceof Anthropic.APIError) {
      console.error("AI analysis failed", e.status, e.message);
      throw new AnalysisError("The AI analysis failed. Try again.");
    }
    throw e;
  }

  if (message.stop_reason === "refusal") {
    throw new AnalysisError("The AI declined to analyze this clip.");
  }
  if (message.stop_reason === "max_tokens") {
    throw new AnalysisError("The AI response was cut off. Try fewer frames or a shorter window.");
  }
  const json = message.content.find((b) => b.type === "text")?.text ?? "";
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new AnalysisError("The AI returned an unreadable answer. Try again.");
  }
  const analysis = parseAnalysis(raw);
  if (!analysis) throw new AnalysisError("The AI returned an incomplete answer. Try again.");
  return { analysis, model: message.model };
}
