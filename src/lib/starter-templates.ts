import type { Enums } from "@/types/database";

type Ex = {
  name: string;
  sets: number;
  reps: string;
  intensity?: string;
  rest?: number;
  notes?: string;
};
type Day = { name: string; session: Enums<"session_type">; exercises: Ex[] };
export type StarterTemplate = {
  name: string;
  description: string;
  type: Enums<"program_type">;
  phase: Enums<"season_phase">;
  weeks: { label?: string; days: Day[] }[];
};

const ARM_CARE_WARMUP: Ex[] = [
  { name: "Band External Rotation", sets: 2, reps: "15" },
  { name: "Band Pull-Apart", sets: 2, reps: "15" },
  { name: "Jaeger Band Throwing Acceleration", sets: 1, reps: "10" },
  { name: "Jaeger Band Throwing Deceleration", sets: 1, reps: "10" },
];

const LONG_TOSS_DISTANCE = ["90 ft", "120 ft", "150 ft", "180 ft", "200+ ft", "Max distance"];

type PitcherWeekDose = {
  label: string;
  mainSets: number;
  mainReps: string;
  assistanceSets: number;
  assistanceReps: string;
  powerSets: number;
  intensity: string;
  progressionNote: string;
};

function pitcherWeekDose(week: number): PitcherWeekDose {
  if (week === 4 || week === 8 || week === 12) {
    return {
      label: week === 12 ? "Deload · transition" : "Deload",
      mainSets: 2,
      mainReps: week === 4 ? "6" : week === 8 ? "5" : "4",
      assistanceSets: 2,
      assistanceReps: "6–8",
      powerSets: 2,
      intensity: "RPE 6",
      progressionNote: "Deload week: keep the work easy; no testing.",
    };
  }

  if (week <= 3) {
    return {
      label: "Base",
      mainSets: 3,
      mainReps: "8",
      assistanceSets: 3,
      assistanceReps: "8–10",
      powerSets: 3,
      intensity: week === 1 ? "RPE 6" : week === 2 ? "RPE 6–7" : "RPE 7",
      progressionNote:
        week === 1
          ? "Start conservatively and log loads."
          : "Add a small load only if every rep stays crisp at the target RPE.",
    };
  }

  if (week <= 7) {
    return {
      label: "Strength",
      mainSets: 4,
      mainReps: "5",
      assistanceSets: 3,
      assistanceReps: "6–8",
      powerSets: 3,
      intensity: week === 5 ? "RPE 6–7" : week === 6 ? "RPE 7" : "RPE 7–8",
      progressionNote: "Add load only when all sets stay within the target RPE; no grinders.",
    };
  }

  return {
    label: "Strength + power",
    mainSets: 4,
    mainReps: "3–4",
    assistanceSets: 2,
    assistanceReps: "5–6",
    powerSets: 3,
    intensity: week === 9 ? "RPE 7" : week === 10 ? "RPE 7–8" : "RPE 8 cap",
    progressionNote: "Keep bar speed and technique high; stop before reps grind.",
  };
}

function pitcherPlanExercise(
  name: string,
  sets: number,
  reps: string,
  intensity = "",
  rest = 60,
  notes = "",
): Ex {
  return { name, sets, reps, intensity, rest, notes };
}

function buildPitcherOffseasonWeek(week: number): StarterTemplate["weeks"][number] {
  const dose = pitcherWeekDose(week);
  const isDeload = week === 4 || week === 8 || week === 12;
  const unilateralReps = week <= 4 ? "8/side" : week <= 8 ? "6/side" : week <= 11 ? "5/side" : "6/side";
  const mainNotes = dose.progressionNote;

  return {
    label: `Week ${week} · ${dose.label}`,
    days: [
      {
        name: "Day 1 · Squat + acceleration",
        session: "strength",
        exercises: [
          pitcherPlanExercise("10-Yard Sprint", 4, "1 rep", "Fast; full recovery", 90, "Stop if sprint speed drops."),
          pitcherPlanExercise("Med Ball Rotational Scoop Toss", dose.powerSets, "4/side", "Fast, crisp reps", 60, "Use a ball he can accelerate cleanly; stop before fatigue."),
          pitcherPlanExercise("Front Squat", dose.mainSets, dose.mainReps, dose.intensity, 150, mainNotes),
          pitcherPlanExercise("Rear-Foot Elevated Split Squat", dose.assistanceSets, unilateralReps, "RPE 6–7", 90),
          pitcherPlanExercise("Chest-Supported Row", dose.assistanceSets, dose.assistanceReps, "RPE 6–7", 75),
          pitcherPlanExercise("Nordic Hamstring Curl", isDeload ? 1 : 2, "4–6", "Controlled lowering", 90),
          pitcherPlanExercise("Band External Rotation", 2, "12–15", "Easy, controlled", 45),
        ],
      },
      {
        name: "Day 2 · Hinge + upper",
        session: "strength",
        exercises: [
          pitcherPlanExercise("Broad Jump", dose.powerSets, "3", "Fast, crisp reps", 75, "Reset fully between jumps."),
          pitcherPlanExercise("Med Ball Chest Pass", dose.powerSets, "4", "Fast, crisp reps", 60),
          pitcherPlanExercise("Trap Bar Deadlift", dose.mainSets, dose.mainReps, dose.intensity, 150, mainNotes),
          pitcherPlanExercise("Single-Leg RDL", dose.assistanceSets, unilateralReps, "RPE 6–7", 90),
          pitcherPlanExercise("Dumbbell Bench Press", dose.assistanceSets, dose.assistanceReps, "RPE 6–7", 90, "Use a comfortable range; do not force shoulder range."),
          pitcherPlanExercise("Pull-Up", dose.assistanceSets, "6–8", "Leave 2–3 reps in reserve", 90),
          pitcherPlanExercise("Prone Y Raise", 2, "10–12", "Easy, controlled", 45),
        ],
      },
      {
        name: "Day 3 · Single-leg + rotation",
        session: "strength",
        exercises: [
          pitcherPlanExercise("Lateral Bound", dose.powerSets, "3/side", "Fast, crisp reps", 75, "Stick each landing before the next rep."),
          pitcherPlanExercise("Med Ball Step-Behind Rotational Throw", dose.powerSets, "4/side", "Fast, crisp reps", 60, "Use a ball he can accelerate cleanly; stop before fatigue."),
          pitcherPlanExercise("Step-Up", dose.mainSets, unilateralReps, dose.intensity, 120, mainNotes),
          pitcherPlanExercise("Hip Thrust", dose.assistanceSets, dose.assistanceReps, "RPE 6–7", 90),
          pitcherPlanExercise("Landmine Press", dose.assistanceSets, "6–8/side", "RPE 6–7", 90, "Smooth reps; do not force range."),
          pitcherPlanExercise("Single-Arm Dumbbell Row", dose.assistanceSets, "8/side", "RPE 6–7", 75),
          pitcherPlanExercise("Copenhagen Plank", 2, "15–20 sec/side", "Controlled", 45),
          pitcherPlanExercise("Pronation and Supination", 2, "12/side", "Light, controlled", 45),
        ],
      },
    ],
  };
}

const COLLEGE_PITCHER_OFFSEASON: StarterTemplate = {
  name: "College Pitcher Offseason Strength (12 weeks)",
  description:
    "Three lifts per week: base, strength, then power. Deload weeks 4, 8, and 12. Use RPE 6–8 and coordinate lifting with his throwing schedule and college staff.",
  type: "strength",
  phase: "off_season",
  weeks: Array.from({ length: 12 }, (_, index) => buildPitcherOffseasonWeek(index + 1)),
};

/** Built-in templates coaches can add to their org in one click. Uses global library exercises. */
export const STARTER_TEMPLATES: StarterTemplate[] = [
  COLLEGE_PITCHER_OFFSEASON,
  {
    name: "Long Toss Build-up (6 weeks)",
    description:
      "Off-season arm strength build: J-Band warm-up, catch play, and long toss stretching out ~30 ft a week, with an arm-care recovery day between throwing days.",
    type: "throwing",
    phase: "off_season",
    weeks: LONG_TOSS_DISTANCE.map((dist, w) => ({
      label: w === 5 ? "Max distance" : undefined,
      days: [
        {
          name: "Long Toss",
          session: "throwing",
          exercises: [
            ...ARM_CARE_WARMUP,
            { name: "Catch Play Progression", sets: 1, reps: "10 min" },
            {
              name: "Long Toss",
              sets: 1,
              reps: `${20 + w * 3} throws`,
              intensity: dist,
              notes: "Arc out to distance, then pull down on a line for the last 8–10 throws.",
            },
          ],
        },
        {
          name: "Arm Care Recovery",
          session: "recovery",
          exercises: [
            { name: "Prone Y Raise", sets: 2, reps: "12" },
            { name: "Prone T Raise", sets: 2, reps: "12" },
            { name: "Side-Lying External Rotation", sets: 2, reps: "12" },
            { name: "Pronation and Supination", sets: 2, reps: "15" },
            { name: "Sleeper Stretch", sets: 2, reps: "30s" },
          ],
        },
        {
          name: w >= 2 ? "Long Toss + Flat Ground" : "Long Toss",
          session: "throwing",
          exercises: [
            ...ARM_CARE_WARMUP,
            { name: "Catch Play Progression", sets: 1, reps: "10 min" },
            { name: "Long Toss", sets: 1, reps: `${18 + w * 3} throws`, intensity: dist },
            ...(w >= 2
              ? [
                  {
                    name: "Flat Ground Throwing",
                    sets: 1,
                    reps: `${10 + (w - 2) * 5} pitches`,
                    intensity: "70–75%",
                  },
                ]
              : []),
          ],
        },
      ],
    })),
  },
  {
    name: "Bullpen Progression (4 weeks)",
    description:
      "Pre-season ramp to game readiness: two bullpens a week building pitch count and intent, with flat ground and arm care between.",
    type: "throwing",
    phase: "pre_season",
    weeks: [
      { pitches: 20, effort: "75%" },
      { pitches: 25, effort: "80%" },
      { pitches: 30, effort: "85–90%" },
      { pitches: 35, effort: "90%+, mix in all pitches" },
    ].map(({ pitches, effort }) => ({
      days: [
        {
          name: "Bullpen",
          session: "throwing",
          exercises: [
            ...ARM_CARE_WARMUP,
            { name: "Long Toss", sets: 1, reps: "15 throws", intensity: "120 ft" },
            { name: "Bullpen Session", sets: 1, reps: `${pitches} pitches`, intensity: effort },
          ],
        },
        {
          name: "Flat Ground + Arm Care",
          session: "throwing",
          exercises: [
            ...ARM_CARE_WARMUP,
            { name: "Flat Ground Throwing", sets: 1, reps: "15 pitches", intensity: "70%" },
            { name: "Prone Y Raise", sets: 2, reps: "12" },
            { name: "Face Pull", sets: 2, reps: "15" },
          ],
        },
        {
          name: "Bullpen",
          session: "throwing",
          exercises: [
            ...ARM_CARE_WARMUP,
            { name: "Long Toss", sets: 1, reps: "15 throws", intensity: "120 ft" },
            { name: "Bullpen Session", sets: 1, reps: `${pitches + 5} pitches`, intensity: effort },
          ],
        },
      ],
    })),
  },
  {
    name: "Daily Arm Care (J-Bands)",
    description: "10-minute band routine before any throwing, every day.",
    type: "arm_care",
    phase: "in_season",
    weeks: [
      {
        days: [
          {
            name: "Daily Arm Care",
            session: "recovery",
            exercises: [
              { name: "Jaeger Band Forward Fly", sets: 1, reps: "10" },
              { name: "Jaeger Band Reverse Fly", sets: 1, reps: "10" },
              { name: "Band External Rotation", sets: 1, reps: "15" },
              { name: "Band Internal Rotation", sets: 1, reps: "15" },
              { name: "90/90 Band External Rotation", sets: 1, reps: "10" },
              { name: "Jaeger Band Throwing Acceleration", sets: 1, reps: "10" },
              { name: "Jaeger Band Throwing Deceleration", sets: 1, reps: "10" },
              { name: "Band Pull-Apart", sets: 1, reps: "15" },
            ],
          },
        ],
      },
    ],
  },
];
