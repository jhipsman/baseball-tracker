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

/** Built-in templates coaches can add to their org in one click. Uses global library exercises. */
export const STARTER_TEMPLATES: StarterTemplate[] = [
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
