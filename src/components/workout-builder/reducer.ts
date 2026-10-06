import type {
  BuilderDay,
  BuilderItem,
  BuilderState,
  BuilderWeek,
  GroupType,
  SessionType,
} from "./types";

export type BuilderAction =
  | { type: "setActiveWeek"; index: number }
  | { type: "addWeek" }
  | { type: "duplicateWeek"; index: number }
  | { type: "removeWeek"; index: number }
  | { type: "updateWeek"; index: number; patch: Partial<Pick<BuilderWeek, "label" | "notes">> }
  | { type: "addDay"; weekIndex: number }
  | { type: "removeDay"; dayId: string }
  | { type: "duplicateDay"; dayId: string }
  | {
      type: "updateDay";
      dayId: string;
      patch: Partial<Pick<BuilderDay, "name" | "sessionType" | "dayOfWeek" | "notes">>;
    }
  | { type: "addExercise"; dayId: string; exerciseId: string; index?: number }
  /** Live move while dragging; no group changes. */
  | { type: "moveRaw"; itemId: string; toDayId: string; toIndex: number }
  /** Final move on drop; applies grouping rules. */
  | { type: "drop"; itemId: string; toDayId: string; toIndex: number }
  | { type: "updateItem"; itemId: string; patch: Partial<Omit<BuilderItem, "id">> }
  | { type: "removeItem"; itemId: string }
  | { type: "toggleSelect"; itemId: string }
  | { type: "clearSelection" }
  | { type: "groupSelected"; groupType: GroupType }
  | { type: "ungroup"; dayId: string; groupId: string }
  | { type: "replaceWeeks"; weeks: BuilderWeek[] };

let idFactory: () => string = () => crypto.randomUUID();
/** Test hook for deterministic ids. */
export function setIdFactory(fn: () => string) {
  idFactory = fn;
}
const newId = () => idFactory();

export function newItem(exerciseId: string): BuilderItem {
  return {
    id: newId(),
    exerciseId,
    groupId: null,
    groupType: null,
    sets: 3,
    reps: "8",
    intensity: "",
    tempo: "",
    restSeconds: null,
    notes: "",
  };
}

export function newDay(index: number, sessionType: SessionType = "strength"): BuilderDay {
  return {
    id: newId(),
    name: `Day ${index + 1}`,
    sessionType,
    dayOfWeek: null,
    notes: "",
    items: [],
  };
}

function cloneDay(day: BuilderDay): BuilderDay {
  // Re-key groups too so the copy's groups are independent of the original.
  const groupMap = new Map<string, string>();
  return {
    ...day,
    id: newId(),
    items: day.items.map((it) => {
      let groupId = it.groupId;
      if (groupId) {
        if (!groupMap.has(groupId)) groupMap.set(groupId, newId());
        groupId = groupMap.get(groupId)!;
      }
      return { ...it, id: newId(), groupId };
    }),
  };
}

/**
 * Keep every group contiguous (members are pulled together at the position of
 * the first one) and dissolve groups with fewer than two members.
 */
export function normalizeGroups(items: BuilderItem[]): BuilderItem[] {
  const byGroup = new Map<string, BuilderItem[]>();
  for (const it of items) {
    if (!it.groupId) continue;
    const list = byGroup.get(it.groupId) ?? [];
    list.push(it);
    byGroup.set(it.groupId, list);
  }

  const emitted = new Set<string>();
  const result: BuilderItem[] = [];
  for (const it of items) {
    if (!it.groupId) {
      result.push(it);
      continue;
    }
    if (emitted.has(it.groupId)) continue;
    emitted.add(it.groupId);
    const members = byGroup.get(it.groupId)!;
    if (members.length < 2) {
      result.push({ ...it, groupId: null, groupType: null });
    } else {
      result.push(...members);
    }
  }

  // Return the original array when nothing changed so memoized rows don't re-render.
  const unchanged = result.length === items.length && result.every((it, i) => it === items[i]);
  return unchanged ? items : result;
}

type Location = { weekIndex: number; dayIndex: number; itemIndex: number };

export function findItem(weeks: BuilderWeek[], itemId: string): Location | null {
  for (let w = 0; w < weeks.length; w++) {
    for (let d = 0; d < weeks[w].days.length; d++) {
      const i = weeks[w].days[d].items.findIndex((it) => it.id === itemId);
      if (i !== -1) return { weekIndex: w, dayIndex: d, itemIndex: i };
    }
  }
  return null;
}

export function findDay(weeks: BuilderWeek[], dayId: string) {
  for (let w = 0; w < weeks.length; w++) {
    const d = weeks[w].days.findIndex((day) => day.id === dayId);
    if (d !== -1) return { weekIndex: w, dayIndex: d };
  }
  return null;
}

/** Return weeks with one day replaced via `fn`, copying only the changed path. */
function updateDayAt(
  weeks: BuilderWeek[],
  weekIndex: number,
  dayIndex: number,
  fn: (day: BuilderDay) => BuilderDay,
): BuilderWeek[] {
  return weeks.map((w, wi) =>
    wi !== weekIndex ? w : { ...w, days: w.days.map((d, di) => (di !== dayIndex ? d : fn(d))) },
  );
}

function updateDayById(
  weeks: BuilderWeek[],
  dayId: string,
  fn: (day: BuilderDay) => BuilderDay,
): BuilderWeek[] {
  const loc = findDay(weeks, dayId);
  return loc ? updateDayAt(weeks, loc.weekIndex, loc.dayIndex, fn) : weeks;
}

/**
 * Decide the group of an item that was just placed at `index`:
 * - it stays in its group if it is still next to another member;
 * - otherwise it joins a group only when dropped between two of its members;
 * - otherwise it becomes standalone.
 */
function applyGroupRule(items: BuilderItem[], index: number): BuilderItem[] {
  const item = items[index];
  const prev = items[index - 1];
  const next = items[index + 1];

  let groupId: string | null = null;
  let groupType: GroupType | null = null;
  if (item.groupId && (prev?.groupId === item.groupId || next?.groupId === item.groupId)) {
    groupId = item.groupId;
    groupType = item.groupType;
  } else if (prev?.groupId && prev.groupId === next?.groupId) {
    groupId = prev.groupId;
    groupType = prev.groupType;
  }

  if (groupId === item.groupId && groupType === item.groupType) return items;
  const copy = items.slice();
  copy[index] = { ...item, groupId, groupType };
  return copy;
}

function moveItem(
  weeks: BuilderWeek[],
  itemId: string,
  toDayId: string,
  toIndex: number,
): { weeks: BuilderWeek[]; placedIndex: number } | null {
  const from = findItem(weeks, itemId);
  const to = findDay(weeks, toDayId);
  if (!from || !to) return null;

  const item = weeks[from.weekIndex].days[from.dayIndex].items[from.itemIndex];
  let next = updateDayAt(weeks, from.weekIndex, from.dayIndex, (d) => ({
    ...d,
    items: d.items.filter((it) => it.id !== itemId),
  }));
  let placedIndex = 0;
  next = updateDayAt(next, to.weekIndex, to.dayIndex, (d) => {
    placedIndex = Math.max(0, Math.min(toIndex, d.items.length));
    const items = d.items.slice();
    items.splice(placedIndex, 0, item);
    return { ...d, items };
  });
  return { weeks: next, placedIndex };
}

function finalizeDays(weeks: BuilderWeek[], dayIds: string[]) {
  let next = weeks;
  for (const id of new Set(dayIds)) {
    next = updateDayById(next, id, (d) => {
      const items = normalizeGroups(d.items);
      return items === d.items ? d : { ...d, items };
    });
  }
  return next;
}

export function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  const { weeks } = state;

  switch (action.type) {
    case "setActiveWeek":
      return {
        ...state,
        activeWeek: Math.max(0, Math.min(action.index, weeks.length - 1)),
        selection: [],
      };

    case "addWeek": {
      const daysPerWeek = Math.max(1, weeks.at(-1)?.days.length ?? 3);
      const week: BuilderWeek = {
        id: newId(),
        label: "",
        notes: "",
        days: Array.from({ length: daysPerWeek }, (_, i) => newDay(i)),
      };
      return { ...state, weeks: [...weeks, week], activeWeek: weeks.length, selection: [] };
    }

    case "duplicateWeek": {
      const src = weeks[action.index];
      if (!src) return state;
      const copy: BuilderWeek = { ...src, id: newId(), days: src.days.map(cloneDay) };
      const nextWeeks = weeks.slice();
      nextWeeks.splice(action.index + 1, 0, copy);
      return { ...state, weeks: nextWeeks, activeWeek: action.index + 1, selection: [] };
    }

    case "removeWeek": {
      if (weeks.length <= 1) return state;
      const nextWeeks = weeks.filter((_, i) => i !== action.index);
      return {
        ...state,
        weeks: nextWeeks,
        activeWeek: Math.min(state.activeWeek, nextWeeks.length - 1),
        selection: [],
      };
    }

    case "updateWeek":
      return {
        ...state,
        weeks: weeks.map((w, i) => (i === action.index ? { ...w, ...action.patch } : w)),
      };

    case "addDay":
      return {
        ...state,
        weeks: weeks.map((w, i) =>
          i === action.weekIndex ? { ...w, days: [...w.days, newDay(w.days.length)] } : w,
        ),
      };

    case "removeDay":
      return {
        ...state,
        weeks: weeks.map((w) => ({ ...w, days: w.days.filter((d) => d.id !== action.dayId) })),
        selection: [],
      };

    case "duplicateDay": {
      const loc = findDay(weeks, action.dayId);
      if (!loc) return state;
      return {
        ...state,
        weeks: weeks.map((w, wi) => {
          if (wi !== loc.weekIndex) return w;
          const days = w.days.slice();
          const copy = cloneDay(days[loc.dayIndex]);
          days.splice(loc.dayIndex + 1, 0, { ...copy, name: `${copy.name} (copy)` });
          return { ...w, days };
        }),
      };
    }

    case "updateDay":
      return {
        ...state,
        weeks: updateDayById(weeks, action.dayId, (d) => ({ ...d, ...action.patch })),
      };

    case "addExercise": {
      const item = newItem(action.exerciseId);
      let placedIndex = 0;
      let next = updateDayById(weeks, action.dayId, (d) => {
        placedIndex = Math.max(0, Math.min(action.index ?? d.items.length, d.items.length));
        const items = d.items.slice();
        items.splice(placedIndex, 0, item);
        return { ...d, items: applyGroupRule(items, placedIndex) };
      });
      next = finalizeDays(next, [action.dayId]);
      return { ...state, weeks: next };
    }

    case "moveRaw": {
      const moved = moveItem(weeks, action.itemId, action.toDayId, action.toIndex);
      return moved ? { ...state, weeks: moved.weeks } : state;
    }

    case "drop": {
      const from = findItem(weeks, action.itemId);
      if (!from) return state;
      const fromDayId = weeks[from.weekIndex].days[from.dayIndex].id;
      const moved = moveItem(weeks, action.itemId, action.toDayId, action.toIndex);
      if (!moved) return state;
      let next = updateDayById(moved.weeks, action.toDayId, (d) => {
        const items = applyGroupRule(d.items, moved.placedIndex);
        return items === d.items ? d : { ...d, items };
      });
      next = finalizeDays(next, [fromDayId, action.toDayId]);
      const selection = state.selection.includes(action.itemId) ? [] : state.selection;
      return { ...state, weeks: next, selection };
    }

    case "updateItem": {
      const loc = findItem(weeks, action.itemId);
      if (!loc) return state;
      return {
        ...state,
        weeks: updateDayAt(weeks, loc.weekIndex, loc.dayIndex, (d) => ({
          ...d,
          items: d.items.map((it) => (it.id === action.itemId ? { ...it, ...action.patch } : it)),
        })),
      };
    }

    case "removeItem": {
      const loc = findItem(weeks, action.itemId);
      if (!loc) return state;
      return {
        ...state,
        weeks: updateDayAt(weeks, loc.weekIndex, loc.dayIndex, (d) => ({
          ...d,
          items: normalizeGroups(d.items.filter((it) => it.id !== action.itemId)),
        })),
        selection: state.selection.filter((id) => id !== action.itemId),
      };
    }

    case "toggleSelect": {
      if (state.selection.includes(action.itemId)) {
        return { ...state, selection: state.selection.filter((id) => id !== action.itemId) };
      }
      const loc = findItem(weeks, action.itemId);
      if (!loc) return state;
      // Selection is limited to one day; selecting in another day starts over.
      const first = state.selection[0] ? findItem(weeks, state.selection[0]) : null;
      const sameDay = first && first.weekIndex === loc.weekIndex && first.dayIndex === loc.dayIndex;
      return {
        ...state,
        selection: sameDay ? [...state.selection, action.itemId] : [action.itemId],
      };
    }

    case "clearSelection":
      return state.selection.length ? { ...state, selection: [] } : state;

    case "groupSelected": {
      if (state.selection.length < 2) return state;
      const loc = findItem(weeks, state.selection[0]);
      if (!loc) return state;
      const groupId = newId();
      const selected = new Set(state.selection);
      return {
        ...state,
        selection: [],
        weeks: updateDayAt(weeks, loc.weekIndex, loc.dayIndex, (d) => {
          const firstIndex = d.items.findIndex((it) => selected.has(it.id));
          const members = d.items
            .filter((it) => selected.has(it.id))
            .map((it) => ({ ...it, groupId, groupType: action.groupType }));
          const rest = d.items.filter((it) => !selected.has(it.id));
          // Insert the group where its first member was (counting only non-members before it).
          const insertAt = d.items.slice(0, firstIndex).filter((it) => !selected.has(it.id)).length;
          rest.splice(insertAt, 0, ...members);
          return { ...d, items: normalizeGroups(rest) };
        }),
      };
    }

    case "ungroup":
      return {
        ...state,
        weeks: updateDayById(weeks, action.dayId, (d) => ({
          ...d,
          items: d.items.map((it) =>
            it.groupId === action.groupId ? { ...it, groupId: null, groupType: null } : it,
          ),
        })),
      };

    case "replaceWeeks":
      return {
        ...state,
        weeks: action.weeks,
        activeWeek: Math.min(state.activeWeek, action.weeks.length - 1),
      };
  }
}

/** "A", "B1", "B2", "C" labels: one letter per standalone item or group. */
export function blockLabels(items: BuilderItem[]): string[] {
  const labels: string[] = [];
  let letter = -1;
  let indexInGroup = 0;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const continues = it.groupId && items[i - 1]?.groupId === it.groupId;
    if (continues) {
      indexInGroup += 1;
    } else {
      letter += 1;
      indexInGroup = 1;
    }
    const base = letterFor(letter);
    labels.push(it.groupId ? `${base}${indexInGroup}` : base);
  }
  return labels;
}

function letterFor(n: number): string {
  let s = "";
  n += 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Shape expected by the save_program_structure RPC. */
export function toPayload(weeks: BuilderWeek[]) {
  return weeks.map((w, wi) => ({
    id: w.id,
    week_number: wi + 1,
    label: w.label,
    notes: w.notes,
    days: w.days.map((d, di) => ({
      id: d.id,
      day_number: di + 1,
      day_of_week: d.dayOfWeek,
      name: d.name,
      session_type: d.sessionType,
      notes: d.notes,
      sort_order: di,
      exercises: d.items.map((it, ii) => ({
        id: it.id,
        exercise_id: it.exerciseId,
        sort_order: ii,
        group_id: it.groupId,
        group_type: it.groupType,
        sets: it.sets,
        reps: it.reps,
        intensity: it.intensity,
        tempo: it.tempo,
        rest_seconds: it.restSeconds,
        notes: it.notes,
      })),
    })),
  }));
}
