/** Shape of an AI video analysis (also the JSON schema sent to Claude). */
export type VideoAnalysis = {
  summary: string;
  phases: { name: string; time_s: number; notes: string }[];
  strengths: string[];
  improvements: { title: string; detail: string; cue: string; drill: string }[];
  confidence: "low" | "medium" | "high";
  limitations: string;
};

export const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "phases", "strengths", "improvements", "confidence", "limitations"],
  properties: {
    summary: { type: "string", description: "2–3 sentence overview for the coach." },
    phases: {
      type: "array",
      description: "Movement phases seen in the frames, in order.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "time_s", "notes"],
        properties: {
          name: { type: "string" },
          time_s: { type: "number", description: "Timestamp of the frame that shows it." },
          notes: { type: "string" },
        },
      },
    },
    strengths: { type: "array", items: { type: "string" } },
    improvements: {
      type: "array",
      description: "Most important first. At most 3.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail", "cue", "drill"],
        properties: {
          title: { type: "string" },
          detail: { type: "string", description: "What you see and why it matters." },
          cue: { type: "string", description: "A short verbal cue for the player." },
          drill: { type: "string", description: "One drill that addresses it." },
        },
      },
    },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    limitations: {
      type: "string",
      description: "What the frames could not show (camera angle, blur, missing phases).",
    },
  },
} as const;

const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Validates model output into a VideoAnalysis, or null when it doesn't fit. */
export function parseAnalysis(raw: unknown): VideoAnalysis | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const summary = str(r.summary);
  if (!summary) return null;
  const arr = (v: unknown) => (Array.isArray(v) ? v : []);
  const conf = r.confidence === "high" || r.confidence === "medium" ? r.confidence : "low";
  return {
    summary,
    phases: arr(r.phases)
      .slice(0, 12)
      .map((p) => ({
        name: str(p?.name, 80),
        time_s: Number.isFinite(Number(p?.time_s)) ? Math.max(0, Number(p.time_s)) : 0,
        notes: str(p?.notes, 600),
      }))
      .filter((p) => p.name),
    strengths: arr(r.strengths)
      .map((s) => str(s, 400))
      .filter(Boolean)
      .slice(0, 6),
    improvements: arr(r.improvements)
      .slice(0, 3)
      .map((i) => ({
        title: str(i?.title, 120),
        detail: str(i?.detail, 800),
        cue: str(i?.cue, 200),
        drill: str(i?.drill, 400),
      }))
      .filter((i) => i.title),
    confidence: conf,
    limitations: str(r.limitations, 600),
  };
}

/** Plain-text version the coach edits before sharing with the player. */
export function analysisToText(a: VideoAnalysis): string {
  const lines = [a.summary];
  if (a.strengths.length) {
    lines.push("", "What's working:", ...a.strengths.map((s) => `• ${s}`));
  }
  if (a.improvements.length) {
    lines.push("", "Work on:");
    a.improvements.forEach((i, n) => {
      lines.push(`${n + 1}. ${i.title}: ${i.detail}`);
      if (i.cue) lines.push(`   Cue: "${i.cue}"`);
      if (i.drill) lines.push(`   Drill: ${i.drill}`);
    });
  }
  return lines.join("\n");
}
