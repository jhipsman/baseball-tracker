import { describe, expect, it } from "vitest";
import { parseTrainingAnswer } from "./ask-9d";

describe("Ask 9D answers", () => {
  const answer = {
    answer: "Consider contact quality alongside speed.",
    questions: [],
    draftPlan: [],
    sourceIds: ["driveline-contact"],
  };
  it("accepts a source-backed answer", () => {
    expect(parseTrainingAnswer(answer)).toEqual(answer);
  });
  it("rejects invented citations", () => {
    expect(() => parseTrainingAnswer({ ...answer, sourceIds: ["made-up-study"] })).toThrow();
  });
  it("rejects malformed plans and excessive questions", () => {
    expect(() => parseTrainingAnswer({ ...answer, draftPlan: "not an array" })).toThrow();
    expect(() =>
      parseTrainingAnswer({ ...answer, questions: Array(5).fill("Question") }),
    ).toThrow();
  });
});
