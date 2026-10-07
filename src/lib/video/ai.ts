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

/** The human-readable message inside an API error body, e.g. "Your credit balance is too low…". */
function apiMessage(e: InstanceType<typeof Anthropic.APIError>): string {
  const body = e.error as { error?: { message?: unknown }; message?: unknown } | undefined;
  const m = body?.error?.message ?? body?.message ?? e.message;
  return String(m ?? "").slice(0, 300);
}

/** Maps SDK errors to messages a coach can act on. API messages never contain the key. */
function toAnalysisError(e: unknown): Error {
  if (!(e instanceof Anthropic.APIError)) {
    console.error("AI analysis failed", e);
    return e instanceof Error ? e : new Error(String(e));
  }
  const msg = apiMessage(e);
  console.error("AI analysis failed", e.status, msg);
  if (e instanceof Anthropic.APIConnectionTimeoutError) {
    return new AnalysisError(
      "The AI took too long to answer. Try fewer frames or a shorter window.",
    );
  }
  if (e instanceof Anthropic.APIConnectionError) {
    return new AnalysisError("Couldn't reach the AI service. Try again in a minute.");
  }
  if (e instanceof Anthropic.AuthenticationError) {
    return new AnalysisError(
      "The AI key isn't valid. In Vercel, check ANTHROPIC_API_KEY (no spaces or quotes), then redeploy.",
    );
  }
  if (/credit balance/i.test(msg)) {
    return new AnalysisError(
      "Your Anthropic account is out of credits. Add credits at console.anthropic.com → Settings → Billing, then try again.",
    );
  }
  if (e instanceof Anthropic.PermissionDeniedError || e instanceof Anthropic.NotFoundError) {
    return new AnalysisError(`This API key can't use ${AI_MODEL}: ${msg}`);
  }
  if (e instanceof Anthropic.RateLimitError) {
    return new AnalysisError("The AI rate limit was hit. Wait a minute and try again.");
  }
  if (e.status === 529 || e instanceof Anthropic.InternalServerError) {
    return new AnalysisError("The AI service is busy right now. Try again in a minute.");
  }
  return new AnalysisError(`The AI request failed (${e.status ?? "error"}): ${msg}`);
}

export async function analyzeFrames(args: {
  frames: Frame[];
  videoType: Enums<"video_type">;
  title: string;
  playerNotes: string | null;
  focus: string;
}): Promise<{ analysis: VideoAnalysis; model: string }> {
  // Reads ANTHROPIC_API_KEY. Stop well before the route's time limit so the coach gets a real error.
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY?.trim(),
    timeout: 100_000,
    maxRetries: 1,
  });

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

  const request = (withFallbacks: boolean) =>
    client.beta.messages
      .stream({
        model: AI_MODEL,
        max_tokens: 8000,
        thinking: { type: "adaptive" },
        output_config: {
          effort: "medium",
          format: { type: "json_schema", schema: ANALYSIS_SCHEMA },
        },
        // If the model declines, the API retries on Anthropic's recommended fallback model.
        ...(withFallbacks
          ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
          : {}),
        system: SYSTEM,
        messages: [{ role: "user", content }],
      })
      .finalMessage();

  let message: Anthropic.Beta.BetaMessage;
  try {
    try {
      message = await request(true);
    } catch (e) {
      // If this account can't use the fallback beta, run the plain request instead.
      if (e instanceof Anthropic.BadRequestError && /fallback|beta/i.test(apiMessage(e))) {
        message = await request(false);
      } else {
        throw e;
      }
    }
  } catch (e) {
    throw toAnalysisError(e);
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
