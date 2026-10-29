/** Optional sections a team can turn on or off (Settings). Core training is always on. */
export const MODULES = [
  {
    key: "health",
    label: "Player Health",
    description: "Throwing workload, Pitch Smart limits, and arm check-ins.",
  },
  {
    key: "games",
    label: "Games & stats",
    description: "Game and tournament schedules, live scores, box scores, and season stats.",
  },
  {
    key: "practices",
    label: "Practice plans",
    description: "Time-block practice plans with stations, shared with players and parents.",
  },
  {
    key: "videos",
    label: "Video review",
    description: "Players upload swings and pitches; coaches draw, record voice-overs, and use AI.",
  },
  {
    key: "messages",
    label: "Messages",
    description: "Team announcements and coach conversations with players and parents.",
  },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];
export const ALL_MODULES: ModuleKey[] = MODULES.map((m) => m.key);

export const TEAM_TYPES: {
  key: "high_school" | "college" | "travel" | "youth" | "facility" | "other";
  label: string;
  modules: ModuleKey[];
}[] = [
  { key: "high_school", label: "High school team", modules: ALL_MODULES },
  { key: "college", label: "College team", modules: ALL_MODULES },
  { key: "travel", label: "Travel / club team", modules: ALL_MODULES },
  {
    key: "youth",
    label: "Youth / rec team (12 and under)",
    modules: ["health", "games", "practices", "messages"],
  },
  {
    key: "facility",
    label: "Training facility or private instructor",
    modules: ["health", "videos", "messages"],
  },
  { key: "other", label: "Something else", modules: ALL_MODULES },
];

export const hasModule = (modules: readonly string[] | null | undefined, key: ModuleKey) =>
  !modules || modules.includes(key);

export function cleanModules(values: unknown[]): ModuleKey[] {
  return ALL_MODULES.filter((k) => values.includes(k));
}
