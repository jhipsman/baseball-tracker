import type { PracticeBlock } from "./practices";

type Block = Omit<PracticeBlock, "id" | "details" | "stations"> & {
  details?: string;
  stations?: PracticeBlock["stations"];
};

export type StarterPractice = { title: string; notes: string; blocks: Block[] };

/** Built-in practice plans coaches can add to their Templates in one click. */
export const STARTER_PRACTICES: StarterPractice[] = [
  {
    title: "Standard 2-hour practice",
    notes:
      "Full team practice. Rotate station groups every 10 min during individual defense and hitting. Water break built into conditioning transition.",
    blocks: [
      {
        kind: "warmup",
        title: "Dynamic warm-up & arm care",
        durationMin: 15,
        details: "Jog, A-skips, carioca, lunges w/ twist, J-Band routine (10 each).",
      },
      {
        kind: "throwing",
        title: "Catch play",
        durationMin: 15,
        details: "Wrist flips → 60 ft → 90 ft → long toss out to 120 ft. Quick-hands to finish.",
      },
      {
        kind: "defense",
        title: "Individual defense",
        durationMin: 20,
        details: "Two 10-minute rotations.",
        stations: [
          { name: "Infield", coach: "Coach A", detail: "Short hops, backhands, double-play feeds" },
          { name: "Outfield", coach: "Coach B", detail: "Drop steps, do-or-die, crow hops" },
          { name: "Catchers", coach: "Coach C", detail: "Blocking, receiving, transfers" },
        ],
      },
      {
        kind: "team",
        title: "Team defense: bunt coverage & cuts",
        durationMin: 15,
        details: "Bunt D (1st & 3rd crash), cut/relay to 3rd and home.",
      },
      {
        kind: "hitting",
        title: "Hitting stations",
        durationMin: 35,
        details: "Rotate every ~8 minutes.",
        stations: [
          { name: "Live BP", coach: "Coach A", detail: "5 swings + bunt, 3 rounds" },
          { name: "Cage 1", coach: "Coach B", detail: "Front toss, middle-away" },
          { name: "Tee work", detail: "High tee / low tee, 2 rounds of 10" },
          { name: "Short bat / one-hand", detail: "Top & bottom hand drills" },
        ],
      },
      {
        kind: "baserunning",
        title: "Baserunning",
        durationMin: 10,
        details: "Home-to-first through the bag, rounding first, secondary leads at second.",
      },
      {
        kind: "conditioning",
        title: "Conditioning & wrap-up",
        durationMin: 10,
        details: "6× 60-yd sprints, team huddle, tomorrow's plan.",
      },
    ],
  },
  {
    title: "Pre-game routine",
    notes:
      "Start time = arrival. Times work back from first pitch, about 90 minutes before. Home team takes infield/outfield second.",
    blocks: [
      {
        kind: "warmup",
        title: "Team stretch & dynamic warm-up",
        durationMin: 15,
        details: "Jog foul line to foul line, dynamic series, sprint build-ups.",
      },
      {
        kind: "throwing",
        title: "Catch play",
        durationMin: 12,
        details: "Progressive distance, finish with quick-hands and accuracy (10 throws).",
      },
      {
        kind: "hitting",
        title: "Cage rounds",
        durationMin: 20,
        details: "Lineup order, 2 groups.",
        stations: [
          { name: "Cage – group 1 (1–5 hitters)", detail: "Front toss, 3 rounds" },
          { name: "Tee / soft toss – group 2 (6–9 hitters)", detail: "Rotate after 10 min" },
        ],
      },
      {
        kind: "defense",
        title: "Infield / outfield",
        durationMin: 15,
        details:
          "OF throws to 2nd, 3rd, home. IF around the horn, DP, slow rollers, catcher bunts.",
      },
      {
        kind: "pitching",
        title: "Starting pitcher bullpen",
        durationMin: 15,
        details: "~25–30 pitches: FB both sides, offspeed, then sets out of the stretch.",
        stations: [
          { name: "Starter + catcher", coach: "Pitching coach" },
          { name: "Relievers", detail: "Band work, stay loose" },
        ],
      },
      {
        kind: "team",
        title: "Team meeting",
        durationMin: 5,
        details: "Lineup, scouting notes, signs check.",
      },
    ],
  },
  {
    title: "Pitchers & catchers day",
    notes:
      "Battery-focused practice. Track bullpen pitch counts in the Throwing log. Position players can run a separate hitting plan.",
    blocks: [
      {
        kind: "warmup",
        title: "Arm care & mobility",
        durationMin: 15,
        details: "Band ER/IR, Y-T-W, thoracic rotations, hip mobility.",
      },
      {
        kind: "throwing",
        title: "Long toss",
        durationMin: 15,
        details: "Stretch out to comfort distance, then compress back on a line.",
      },
      {
        kind: "pitching",
        title: "PFP (pitcher fielding practice)",
        durationMin: 15,
        details: "Comebackers to 2nd for DP, covering 1st, bunts to 3rd.",
      },
      {
        kind: "pitching",
        title: "Bullpens",
        durationMin: 30,
        details: "Rotate pitchers through 3 mounds; 25–35 pitches each.",
        stations: [
          { name: "Mound 1", coach: "Pitching coach", detail: "Starters: full pen + sets" },
          { name: "Mound 2", detail: "Relievers: 20 pitches, simulate inning entry" },
          { name: "Flat ground", detail: "Rehab / pitch-design work" },
        ],
      },
      {
        kind: "defense",
        title: "Catcher skills",
        durationMin: 20,
        details: "While pens run.",
        stations: [
          { name: "Blocking", coach: "Catching coach", detail: "Machine balls in dirt, 3×10" },
          { name: "Throws to 2nd", detail: "Footwork, pop times" },
          { name: "Framing", detail: "Edges of zone, sticking pitches" },
        ],
      },
      {
        kind: "team",
        title: "Pick-offs & holding runners",
        durationMin: 15,
        details: "Daylight play, 1st-and-3rd defense, timing on slide steps.",
      },
      {
        kind: "conditioning",
        title: "Recovery & arm care",
        durationMin: 10,
        details: "Light band work, flush run, stretch.",
      },
    ],
  },
];
