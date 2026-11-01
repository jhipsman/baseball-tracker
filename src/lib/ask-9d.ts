/** Editorial summaries of public sources, not licensed training programs. */
export const TRAINING_SOURCES = [
  {
    id: "driveline-contact",
    title: "How to Increase Your Exit Velocity and Hit the Ball Harder",
    publisher: "Driveline Baseball",
    url: "https://drivelinebaseball.com/blogs/blog/increase-your-exit-velocity-hit-the-ball-harder",
    summary:
      "Exit velocity depends on both bat speed and square contact. Comparing peak and typical exit velocity can help coaches decide whether to prioritize contact quality, bat speed, or both. Higher peak speed alone does not guarantee consistently hard contact.",
  },
  {
    id: "pitch-smart",
    title: "Pitching guidelines and required rest",
    publisher: "MLB Pitch Smart",
    url: "https://www.mlb.com/pitch-smart/pitching-guidelines",
    summary:
      "Pitching workload and required rest depend on age and pitches thrown. Players and parents must account for participation across leagues and teams. Consult the published age-specific limits and required-rest table rather than guessing a throwing prescription.",
  },
] as const;

export type TrainingAnswer = {
  answer: string;
  questions: string[];
  draftPlan: string[];
  sourceIds: string[];
};

export function parseTrainingAnswer(value: unknown): TrainingAnswer {
  if (!value || typeof value !== "object") throw new Error("Invalid answer");
  const v = value as Record<string, unknown>;
  const strings = (key: string, max: number) => {
    const list = v[key];
    if (
      !Array.isArray(list) ||
      list.length > max ||
      list.some((x) => typeof x !== "string" || x.length > 1500)
    )
      throw new Error("Invalid answer");
    return list as string[];
  };
  if (typeof v.answer !== "string" || !v.answer.trim() || v.answer.length > 6000)
    throw new Error("Invalid answer");
  const sourceIds = strings("sourceIds", TRAINING_SOURCES.length);
  if (sourceIds.some((id) => !TRAINING_SOURCES.some((source) => source.id === id)))
    throw new Error("Unknown source");
  return {
    answer: v.answer,
    questions: strings("questions", 4),
    draftPlan: strings("draftPlan", 6),
    sourceIds: [...new Set(sourceIds)],
  };
}
