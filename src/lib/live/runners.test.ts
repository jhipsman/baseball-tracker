import { describe, expect, it } from "vitest";
import { emptySetup, situation, type Play } from "./engine";
import {
  parsePlayDetails,
  proposeMoves,
  resolveRunnerPlay,
  type Bases,
  type PlayDetails,
} from "./runners";
const resolve = (
  bases: Bases,
  result: "1B" | "BB" | "K" | "HR" | "GO",
  details?: PlayDetails,
  outsBefore = 0,
) =>
  resolveRunnerPlay({
    bases,
    batterId: "batter",
    result,
    outsBefore,
    details: details ?? { version: 1, moves: proposeMoves(bases, "batter", result) },
  });
describe("runner resolution", () => {
  it("forces only connected runners on a walk", () => {
    expect(resolve({ 1: "a", 3: "c" }, "BB")).toMatchObject({
      bases: { 1: "batter", 2: "a", 3: "c" },
      runs: 0,
    });
    expect(resolve({ 1: "a", 2: "b", 3: "c" }, "BB")).toMatchObject({
      bases: { 1: "batter", 2: "a", 3: "b" },
      runs: 1,
      scored: ["c"],
    });
  });
  it("scores all runners on a homer", () =>
    expect(resolve({ 1: "a", 3: "c" }, "HR")).toMatchObject({
      bases: {},
      runs: 3,
      scored: ["a", "c", "batter"],
    }));
  it("blocks collisions, missing identities, and a batter already on base", () => {
    expect(
      resolve({ 1: "a" }, "1B", {
        version: 1,
        moves: [
          { id: "a", from: 1, to: 1 },
          { id: "batter", from: 0, to: 1 },
        ],
      }),
    ).toHaveProperty("error");
    expect(
      resolve({ 1: "a" }, "1B", { version: 1, moves: [{ id: "batter", from: 0, to: 1 }] }),
    ).toHaveProperty("error");
    expect(resolve({ 1: "batter" }, "BB")).toHaveProperty("error");
  });
  it("requires a third-out ruling and suppresses runs on a force", () => {
    const details: PlayDetails = {
      version: 1,
      moves: [
        { id: "a", from: 3, to: "home" },
        { id: "batter", from: 0, to: "out" },
      ],
    };
    expect(resolve({ 3: "a" }, "GO", details, 2)).toHaveProperty("error");
    expect(resolve({ 3: "a" }, "GO", { ...details, thirdOut: "force" }, 2)).toMatchObject({
      bases: {},
      runs: 0,
      outs: 1,
    });
    expect(resolve({ 3: "a" }, "GO", { ...details, thirdOut: "timing" }, 2)).toHaveProperty(
      "error",
    );
    expect(
      resolveRunnerPlay({
        bases: { 1: "a", 3: "c" },
        batterId: null,
        result: null,
        outsBefore: 2,
        details: {
          version: 1,
          thirdOut: "timing",
          moves: [
            { id: "a", from: 1, to: "out" },
            { id: "c", from: 3, to: "home" },
          ],
        },
      }),
    ).toMatchObject({ runs: 1, bases: {} });
  });
  it("rejects malformed JSON at the boundary", () => {
    expect(parsePlayDetails({ version: 1, moves: [{ id: "a", from: 0, to: 7 }] })).toBeNull();
    expect(parsePlayDetails({ version: 1, moves: [], snapshot: { 1: "a", 2: "a" } })).toBeNull();
  });
  it("replays durable positions and undo, and requires reconciliation for legacy plays", () => {
    const setup = emptySetup(["batter", "next"], "p", true);
    const play: Play = {
      seq: 1,
      inning: 1,
      half: "top",
      weBat: true,
      kind: "pa",
      batterId: "batter",
      pitcherId: null,
      slot: null,
      result: "1B",
      rbi: 0,
      runs: 0,
      unearned: 0,
      scored: [],
      pitches: 1,
      outs: 0,
      details: { version: 1, moves: [{ id: "batter", from: 0, to: 1 }] },
    };
    expect(situation(setup, [play])).toMatchObject({
      bases: { 1: "batter" },
      basesKnown: true,
      batterIdx: 1,
    });
    expect(situation(setup, [])).toMatchObject({ bases: {}, basesKnown: true });
    expect(situation(setup, [{ ...play, details: null }]).basesKnown).toBe(false);
    expect(
      situation(setup, [
        { ...play, details: null },
        {
          ...play,
          seq: 2,
          kind: "bases",
          result: null,
          details: { version: 1, moves: [], snapshot: { 2: "batter" } },
        },
      ]),
    ).toMatchObject({ bases: { 2: "batter" }, basesKnown: true });
  });
});
