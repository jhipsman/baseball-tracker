import { beforeEach, describe, expect, it } from "vitest";
import {
  blockLabels,
  builderReducer,
  normalizeGroups,
  setIdFactory,
  toPayload,
  type BuilderAction,
} from "./reducer";
import type { BuilderItem, BuilderState } from "./types";

let n = 0;
beforeEach(() => {
  n = 0;
  setIdFactory(() => `id${++n}`);
});

function item(id: string, groupId: string | null = null): BuilderItem {
  return {
    id,
    exerciseId: `ex-${id}`,
    groupId,
    groupType: groupId ? "superset" : null,
    sets: 3,
    reps: "8",
    intensity: "",
    tempo: "",
    restSeconds: null,
    notes: "",
  };
}

function state(day1: BuilderItem[], day2: BuilderItem[] = []): BuilderState {
  return {
    activeWeek: 0,
    selection: [],
    weeks: [
      {
        id: "w1",
        label: "",
        notes: "",
        days: [
          {
            id: "d1",
            name: "Day 1",
            sessionType: "strength",
            dayOfWeek: null,
            notes: "",
            items: day1,
          },
          {
            id: "d2",
            name: "Day 2",
            sessionType: "strength",
            dayOfWeek: null,
            notes: "",
            items: day2,
          },
        ],
      },
    ],
  };
}

const run = (s: BuilderState, ...actions: BuilderAction[]) => actions.reduce(builderReducer, s);
const ids = (s: BuilderState, day = 0) => s.weeks[0].days[day].items.map((i) => i.id);
const groups = (s: BuilderState, day = 0) => s.weeks[0].days[day].items.map((i) => i.groupId);

describe("normalizeGroups", () => {
  it("dissolves single-member groups", () => {
    const out = normalizeGroups([item("a", "g"), item("b")]);
    expect(out.map((i) => i.groupId)).toEqual([null, null]);
    expect(out[0].groupType).toBeNull();
  });

  it("pulls group members together at the first member", () => {
    const out = normalizeGroups([item("a", "g"), item("b"), item("c", "g")]);
    expect(out.map((i) => i.id)).toEqual(["a", "c", "b"]);
  });

  it("returns the same array when nothing changes", () => {
    const items = [item("a", "g"), item("b", "g"), item("c")];
    expect(normalizeGroups(items)).toBe(items);
  });
});

describe("drop", () => {
  it("reorders within a day", () => {
    const s = run(state([item("a"), item("b"), item("c")]), {
      type: "drop",
      itemId: "a",
      toDayId: "d1",
      toIndex: 2,
    });
    expect(ids(s)).toEqual(["b", "c", "a"]);
  });

  it("moves across days", () => {
    const s = run(state([item("a"), item("b")], [item("x")]), {
      type: "drop",
      itemId: "a",
      toDayId: "d2",
      toIndex: 1,
    });
    expect(ids(s, 0)).toEqual(["b"]);
    expect(ids(s, 1)).toEqual(["x", "a"]);
  });

  it("keeps an item in its group when reordered inside the group", () => {
    const s = run(state([item("a", "g"), item("b", "g"), item("c")]), {
      type: "drop",
      itemId: "b",
      toDayId: "d1",
      toIndex: 0,
    });
    expect(ids(s)).toEqual(["b", "a", "c"]);
    expect(groups(s)).toEqual(["g", "g", null]);
  });

  it("removes an item from its group when dragged away, dissolving a 2-item group", () => {
    const s = run(state([item("a", "g"), item("b", "g"), item("c")]), {
      type: "drop",
      itemId: "a",
      toDayId: "d1",
      toIndex: 2,
    });
    expect(ids(s)).toEqual(["b", "c", "a"]);
    expect(groups(s)).toEqual([null, null, null]);
  });

  it("joins a group when dropped between two of its members", () => {
    const s = run(state([item("a", "g"), item("b", "g"), item("c")]), {
      type: "drop",
      itemId: "c",
      toDayId: "d1",
      toIndex: 1,
    });
    expect(ids(s)).toEqual(["a", "c", "b"]);
    expect(groups(s)).toEqual(["g", "g", "g"]);
  });

  it("does not join a group when dropped at its edge", () => {
    const s = run(state([item("c"), item("a", "g"), item("b", "g")]), {
      type: "drop",
      itemId: "c",
      toDayId: "d1",
      toIndex: 2,
    });
    expect(ids(s)).toEqual(["a", "b", "c"]);
    expect(groups(s)).toEqual(["g", "g", null]);
  });

  it("leaves the remaining group intact when one of three members moves to another day", () => {
    const s = run(state([item("a", "g"), item("b", "g"), item("c", "g")]), {
      type: "drop",
      itemId: "b",
      toDayId: "d2",
      toIndex: 0,
    });
    expect(groups(s, 0)).toEqual(["g", "g"]);
    expect(groups(s, 1)).toEqual([null]);
  });
});

describe("addExercise", () => {
  it("appends to the end by default with sensible defaults", () => {
    const s = run(state([item("a")]), { type: "addExercise", dayId: "d1", exerciseId: "squat" });
    const added = s.weeks[0].days[0].items[1];
    expect(added).toMatchObject({ exerciseId: "squat", sets: 3, reps: "8", groupId: null });
  });

  it("inserts at an index and joins a group when placed inside it", () => {
    const s = run(state([item("a", "g"), item("b", "g")]), {
      type: "addExercise",
      dayId: "d1",
      exerciseId: "squat",
      index: 1,
    });
    expect(groups(s)).toEqual(["g", "g", "g"]);
  });
});

describe("grouping", () => {
  it("groups selected items contiguously at the first selected position", () => {
    const s = run(
      state([item("a"), item("b"), item("c"), item("d")]),
      { type: "toggleSelect", itemId: "b" },
      { type: "toggleSelect", itemId: "d" },
      { type: "groupSelected", groupType: "circuit" },
    );
    expect(ids(s)).toEqual(["a", "b", "d", "c"]);
    const items = s.weeks[0].days[0].items;
    expect(items[1].groupId).toBe(items[2].groupId);
    expect(items[1].groupType).toBe("circuit");
    expect(s.selection).toEqual([]);
  });

  it("limits selection to one day", () => {
    const s = run(
      state([item("a")], [item("x")]),
      { type: "toggleSelect", itemId: "a" },
      { type: "toggleSelect", itemId: "x" },
    );
    expect(s.selection).toEqual(["x"]);
  });

  it("ungroups", () => {
    const s = run(state([item("a", "g"), item("b", "g")]), {
      type: "ungroup",
      dayId: "d1",
      groupId: "g",
    });
    expect(groups(s)).toEqual([null, null]);
  });

  it("removing a member dissolves a two-member group", () => {
    const s = run(state([item("a", "g"), item("b", "g")]), { type: "removeItem", itemId: "a" });
    expect(groups(s)).toEqual([null]);
  });
});

describe("weeks and days", () => {
  it("duplicates a week with fresh ids and independent groups", () => {
    const s = run(state([item("a", "g"), item("b", "g")]), { type: "duplicateWeek", index: 0 });
    expect(s.weeks).toHaveLength(2);
    expect(s.activeWeek).toBe(1);
    const copy = s.weeks[1].days[0].items;
    expect(copy.map((i) => i.id)).not.toContain("a");
    expect(copy[0].groupId).toBe(copy[1].groupId);
    expect(copy[0].groupId).not.toBe("g");
  });

  it("adds a week with the same number of days as the last one", () => {
    const s = run(state([]), { type: "addWeek" });
    expect(s.weeks[1].days).toHaveLength(2);
  });

  it("never removes the last week", () => {
    const s = run(state([]), { type: "removeWeek", index: 0 });
    expect(s.weeks).toHaveLength(1);
  });
});

describe("blockLabels", () => {
  it("labels standalone items and groups", () => {
    expect(
      blockLabels([
        item("a"),
        item("b", "g"),
        item("c", "g"),
        item("d"),
        item("e", "h"),
        item("f", "h"),
      ]),
    ).toEqual(["A", "B1", "B2", "C", "D1", "D2"]);
  });
});

describe("toPayload", () => {
  it("numbers weeks, days and exercises by position", () => {
    const s = run(state([item("a"), item("b")], [item("c")]), { type: "addWeek" });
    const p = toPayload(s.weeks);
    expect(p.map((w) => w.week_number)).toEqual([1, 2]);
    expect(p[0].days.map((d) => [d.day_number, d.sort_order])).toEqual([
      [1, 0],
      [2, 1],
    ]);
    expect(p[0].days[0].exercises.map((e) => [e.id, e.sort_order])).toEqual([
      ["a", 0],
      ["b", 1],
    ]);
  });
});
