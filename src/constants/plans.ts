/**
 * Plans and limits. Billing is off ("pilot mode") until BILLING_ENABLED=true;
 * then free teams hit these limits and see upgrade prompts.
 * DB values (organizations.plan_tier): free | pro (Team) | enterprise (Club).
 */
export type PlanKey = "free" | "pro" | "enterprise";

export type Plan = {
  key: PlanKey;
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  /** null = unlimited */
  limits: { players: number | null; videosPerMonth: number | null; aiPerMonth: number };
  features: string[];
};

export const PLANS: Plan[] = [
  {
    key: "free",
    name: "Free",
    price: "$0",
    cadence: "forever",
    blurb: "Try it with a small team.",
    limits: { players: 15, videosPerMonth: 10, aiPerMonth: 3 },
    features: [
      "Up to 15 players",
      "Programs, workout logging, testing",
      "Player Health: throwing & Pitch Smart",
      "Schedule, live game log, stats",
      "10 video uploads a month",
    ],
  },
  {
    key: "pro",
    name: "Team",
    price: "$199",
    cadence: "per team, per year",
    blurb: "Everything a high school or travel team needs.",
    limits: { players: 40, videosPerMonth: null, aiPerMonth: 30 },
    features: [
      "Up to 40 players",
      "Unlimited video review with voice-over",
      "30 AI video analyses a month",
      "Parent dashboard, messages, practice plans",
      "Pay by card, or request an invoice for your school",
    ],
  },
  {
    key: "enterprise",
    name: "Club",
    price: "$79",
    cadence: "per month",
    blurb: "For training facilities, instructors, and big clubs.",
    limits: { players: null, videosPerMonth: null, aiPerMonth: 150 },
    features: [
      "Unlimited players",
      "Unlimited video review",
      "150 AI video analyses a month",
      "Remote lessons with narrated breakdowns",
      "Priority support",
    ],
  },
];

export const planOf = (key: string | null | undefined) =>
  PLANS.find((p) => p.key === key) ?? PLANS[0];

/** Pilot mode: when billing is off, every team gets Club limits for free. */
export const billingEnabled = () => process.env.BILLING_ENABLED === "true";
