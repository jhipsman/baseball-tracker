import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptySetup, type LiveSetup } from "./live/engine";
import type { PitchKind } from "./live/pitch-count";

const mocks = vi.hoisted(() => ({ org: vi.fn() }));
vi.mock("@/lib/org", () => ({ requireActiveOrg: mocks.org }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/push", () => ({ dispatchPush: vi.fn() }));
vi.mock("server-only", () => ({}));

import { finishLiveGame, recordPitch, recordPlay, undoLastPlay } from "./live-actions";

const GAME = "00000000-0000-4000-8000-000000000001";
const ORG = "00000000-0000-4000-8000-000000000002";
const P1 = "00000000-0000-4000-8000-000000000003";
const P2 = "00000000-0000-4000-8000-000000000004";
const BATTER = "00000000-0000-4000-8000-000000000005";
type Row = Record<string, unknown>;
type Response = { data: Row | Row[] | null; error: null; count?: number };

/** Minimal in-memory query transport: assertions below exercise the real server actions. */
class Query implements PromiseLike<Response> {
  private filters: [string, unknown][] = [];
  private values: Row | null = null;
  private operation = "select";
  private descending = false;
  private max = Infinity;
  constructor(
    private db: Store,
    private table: string,
  ) {}
  select() {
    return this;
  }
  eq(key: string, value: unknown) {
    this.filters.push([key, value]);
    return this;
  }
  order(_key: string, options?: { ascending?: boolean }) {
    this.descending = options?.ascending === false;
    return this;
  }
  limit(n: number) {
    this.max = n;
    return this;
  }
  update(values: Row) {
    this.operation = "update";
    this.values = values;
    return this;
  }
  insert(values: Row) {
    this.operation = "insert";
    this.values = values;
    return this;
  }
  delete() {
    this.operation = "delete";
    return this;
  }
  private execute(single = false): Response {
    const rows =
      this.table === "games"
        ? [this.db.game]
        : this.table === "game_plays"
          ? this.db.plays
          : this.db.pitching;
    const matches = (r: Row) => this.filters.every(([k, v]) => r[k] === v);
    if (this.operation === "insert") {
      rows.push({
        id: `play-${rows.length + 1}`,
        slot: null,
        batter_id: null,
        pitcher_id: null,
        result: null,
        runs: 0,
        rbi: 0,
        unearned: 0,
        scored: [],
        pitches: 0,
        outs: 0,
        ...this.values,
      });
    } else if (this.operation === "update") {
      rows.filter(matches).forEach((r) => Object.assign(r, structuredClone(this.values)));
    } else if (this.operation === "delete") {
      this.db.plays = rows.filter((r) => !matches(r));
    }
    let found = rows.filter(matches).map((r) => structuredClone(r));
    if (this.descending) found = found.sort((a, b) => Number(b.seq) - Number(a.seq));
    found = found.slice(0, this.max);
    return { data: single ? (found[0] ?? null) : found, error: null, count: found.length };
  }
  async maybeSingle() {
    return this.execute(true);
  }
  then<TResult1 = Response, TResult2 = never>(
    fulfilled?: ((value: Response) => TResult1 | PromiseLike<TResult1>) | null,
    rejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(fulfilled, rejected);
  }
}

class Store {
  game: Row = {
    id: GAME,
    org_id: ORG,
    status: "live",
    live_state: emptySetup([BATTER], P1, false),
  };
  plays: Row[] = [];
  pitching: Row[] = [{ game_id: GAME, player_id: P1, decision: "W" }];
  rpc = vi.fn(async (...args: [string, unknown]) => {
    if (args[0] !== "save_box_score") throw new Error("Unexpected RPC");
    return { data: null, error: null };
  });
  from(table: string) {
    return new Query(this, table);
  }
  get live() {
    return this.game.live_state as LiveSetup;
  }
  get box() {
    const call = this.rpc.mock.calls.at(-1);
    if (!call) throw new Error("No box score was saved");
    return (
      call[1] as {
        p_pitching: { player_id: string; pitches: number; outs: number; decision: string | null }[];
      }
    ).p_pitching;
  }
}

let db: Store;
beforeEach(() => {
  db = new Store();
  mocks.org.mockResolvedValue({
    supabase: db,
    org: { id: ORG },
    user: { id: BATTER },
    isStaff: true,
  });
});

const setCount = (extra: Partial<LiveSetup>) => {
  db.game.live_state = { ...db.live, ...extra };
};

describe("live pitch persistence", () => {
  it("updates workload and the viewer summary on the first pitch, preserving decisions", async () => {
    expect(await recordPitch(GAME, "ball")).toEqual({});
    expect(db.live).toMatchObject({
      balls: 1,
      pitches: 1,
      summary: { pitcherPitches: 1, balls: 1 },
    });
    expect(db.box).toEqual([expect.objectContaining({ player_id: P1, pitches: 1, decision: "W" })]);
    expect(db.plays).toHaveLength(0);
  });

  it("reset count leaves workload intact, while minus restores the recorded count", async () => {
    await recordPitch(GAME, "ball");
    await recordPitch(GAME, "called");
    await recordPitch(GAME, "minus");
    expect(db.live).toMatchObject({ balls: 1, strikes: 0, pitches: 1 });
    expect(db.box[0].pitches).toBe(1);
    await recordPitch(GAME, "reset");
    expect(db.live).toMatchObject({ balls: 0, strikes: 0, pitches: 1 });
    expect(db.box[0].pitches).toBe(1);
  });

  it("moves counted pitches into a completed PA exactly once", async () => {
    for (let i = 0; i < 3; i++) await recordPitch(GAME, "ball");
    expect(await recordPitch(GAME, "ball")).toEqual({ auto: "BB" });
    expect(db.plays).toHaveLength(1);
    expect(db.plays[0]).toMatchObject({ result: "BB", pitches: 4 });
    expect(db.live).toMatchObject({ balls: 0, strikes: 0, pitches: 0, pitchHistory: [] });
    expect(db.box[0].pitches).toBe(4);
  });

  it("counts in-play contact once when its result is recorded", async () => {
    await recordPitch(GAME, "in_play");
    await recordPlay(GAME, { kind: "pa", result: "1B" });
    expect(db.box[0].pitches).toBe(1);
    expect(db.plays[0]).toMatchObject({ pitches: 1, result: "1B" });
  });

  it.each(["foul_bunt", "foul_tip"] as const)("completes a two-strike %s", async (kind) => {
    setCount({ strikes: 2, pitches: 2 });
    expect(await recordPitch(GAME, kind)).toEqual({ auto: "K" });
    expect(db.box[0]).toMatchObject({ pitches: 3, outs: 1 });
  });

  it("keeps the count and credits each pitcher only his segment", async () => {
    setCount({ balls: 2, strikes: 1, pitches: 4 });
    expect(await recordPlay(GAME, { kind: "sub", playerId: P2 })).toEqual({});
    expect(db.live).toMatchObject({ balls: 2, strikes: 1, pitches: 0 });
    expect(db.plays[0]).toMatchObject({ kind: "sub", pitcher_id: P2, pitches: 4 });
    expect(db.box.find((p) => p.player_id === P1)?.pitches).toBe(4);
    await recordPitch(GAME, "called");
    expect(db.live).toMatchObject({ balls: 2, strikes: 2, pitches: 1 });
    await recordPitch(GAME, "swinging");
    expect(db.box.find((p) => p.player_id === P1)).toMatchObject({ pitches: 4, outs: 0 });
    expect(db.box.find((p) => p.player_id === P2)).toMatchObject({ pitches: 2, outs: 1 });
  });

  it("restores banked pitches when a pitching change is undone", async () => {
    setCount({ balls: 1, strikes: 2, pitches: 5 });
    await recordPlay(GAME, { kind: "sub", playerId: P2 });
    expect(await undoLastPlay(GAME)).toEqual({});
    expect(db.live).toMatchObject({ balls: 1, strikes: 2, pitches: 5 });
    expect(db.box).toEqual([expect.objectContaining({ player_id: P1, pitches: 5 })]);
  });

  it("does not reassign pitches thrown after a pitching change when undoing", async () => {
    setCount({ pitches: 3 });
    await recordPlay(GAME, { kind: "sub", playerId: P2 });
    await recordPitch(GAME, "ball");
    expect(await undoLastPlay(GAME)).toHaveProperty("error");
    expect(db.plays).toHaveLength(1);
    await recordPitch(GAME, "minus");
    expect(await undoLastPlay(GAME)).toEqual({});
    expect(db.box).toEqual([expect.objectContaining({ player_id: P1, pitches: 3 })]);
  });

  it.each(["half_end", "caught_stealing"])(
    "keeps pending pitches when %s ends the half",
    async (ending) => {
      if (ending === "caught_stealing") {
        await recordPlay(GAME, { kind: "pa", result: "DP" });
      }
      setCount({ balls: 1, strikes: 1, pitches: 3 });
      await recordPlay(
        GAME,
        ending === "half_end" ? { kind: "half_end" } : { kind: "steal", result: "CS" },
      );
      expect(db.live).toMatchObject({
        balls: 0,
        strikes: 0,
        pitches: 0,
        summary: { half: "bottom" },
      });
      expect(db.box[0]).toMatchObject({ pitches: 3, outs: 3 });
    },
  );

  it("retains an unfinished at-bat on finalization and allows resuming its count", async () => {
    setCount({ balls: 2, strikes: 1, pitches: 5 });
    expect(await finishLiveGame(GAME)).toEqual({});
    expect(db.game.status).toBe("final");
    expect(db.live).toMatchObject({ balls: 2, strikes: 1, pitches: 5 });
    expect(db.box[0].pitches).toBe(5);
    db.game.status = "live";
    await recordPitch(GAME, "foul");
    expect(db.box[0].pitches).toBe(6);
  });

  it.each(["final", "scheduled", "canceled"])(
    "does not record pitches in a %s game",
    async (status) => {
      db.game.status = status;
      expect(await recordPitch(GAME, "ball")).toHaveProperty("error");
      expect(db.rpc).not.toHaveBeenCalled();
    },
  );

  it("rejects pitches while batting and invalid pitch kinds without changing workload", async () => {
    setCount({ weBatFirst: true });
    expect(await recordPitch(GAME, "ball")).toHaveProperty("error");
    setCount({ weBatFirst: false });
    expect(await recordPitch(GAME, "invalid" as PitchKind)).toHaveProperty("error");
    expect(db.rpc).not.toHaveBeenCalled();
    expect(db.live.pitches).toBe(0);
  });
});
