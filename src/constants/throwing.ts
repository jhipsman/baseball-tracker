import type { Enums } from "@/types/database";

export type ThrowingType = Enums<"throwing_type">;
export type ThrowingIntensity = Enums<"throwing_intensity">;
export type ArmFeelValue = Enums<"arm_feel">;

export const THROW_TYPES: { key: ThrowingType; label: string; hint: string }[] = [
  { key: "long_toss", label: "Long toss", hint: "Throws + max distance" },
  { key: "flat_ground", label: "Flat ground", hint: "Pitches off flat ground" },
  { key: "bullpen", label: "Bullpen", hint: "Mound work" },
  { key: "live_abs", label: "Live ABs", hint: "Counts toward Pitch Smart" },
  { key: "game", label: "Game", hint: "Counts toward Pitch Smart" },
  { key: "check_in", label: "Arm check-in", hint: "No throwing, just how the arm feels" },
];
export const THROW_TYPE_LABEL = Object.fromEntries(
  THROW_TYPES.map((t) => [t.key, t.label]),
) as Record<ThrowingType, string>;

export const INTENSITIES: { key: ThrowingIntensity; label: string }[] = [
  { key: "low", label: "Low" },
  { key: "moderate", label: "Moderate" },
  { key: "high", label: "High" },
  { key: "max_effort", label: "Max effort" },
];

/** Arm feel, best → worst. Status colors are reserved for state and always paired with a label. */
export const ARM_FEELS: { key: ArmFeelValue; label: string; className: string }[] = [
  { key: "great", label: "Great", className: "bg-brand-600 text-white" },
  { key: "good", label: "Good", className: "bg-brand-100 text-brand-900" },
  { key: "okay", label: "Okay", className: "bg-zinc-200 text-zinc-800" },
  { key: "tired", label: "Tired", className: "bg-amber-200 text-amber-950" },
  { key: "sore", label: "Sore", className: "bg-orange-300 text-orange-950" },
  { key: "pain", label: "Pain", className: "bg-red-600 text-white" },
];
export const ARM_FEEL = Object.fromEntries(ARM_FEELS.map((f) => [f.key, f])) as Record<
  ArmFeelValue,
  (typeof ARM_FEELS)[number]
>;

export const PITCH_TYPES = [
  { key: "fastball", label: "FB" },
  { key: "curveball", label: "CB" },
  { key: "slider", label: "SL" },
  { key: "changeup", label: "CH" },
  { key: "other", label: "Other" },
] as const;

export const PITCH_SMART_NOTE =
  "Limits follow MLB/USA Baseball Pitch Smart guidelines for games and live at-bats. They're guidelines, not medical advice, and your league may be stricter.";
