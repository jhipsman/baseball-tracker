/**
 * Exercise diagrams: a few key poses per movement, the equipment, and the
 * muscles doing the work. Our own drawings, built on ./skeleton.
 */
import { GROUND, type Anchor, type Point, type Pose, type View } from "./skeleton";

export type Segment = "torso" | "upper" | "fore" | "thigh" | "shin";
export type Holder = "hands" | "nearHand" | "farHand" | "back";
export type Prop =
  | { kind: "barbell" | "dumbbell" | "kettlebell" | "medball" | "ball"; at: Holder }
  /** From one hand to an anchor point, or (no `to`) stretched between the hands. */
  | { kind: "band"; from: "nearHand" | "farHand" | "hands"; to?: Point }
  | { kind: "post"; x: number; top: number }
  | { kind: "bench" | "box"; x: number; y: number; w: number; h: number }
  | { kind: "bar"; x1: number; x2: number; y: number };

export type Figure = {
  view: View;
  anchor: Anchor;
  /** Key poses in order; the figure plays them forward and back. */
  frames: Pose[];
  props?: Prop[];
  focus: Segment[];
  /** One plain-language cue shown under the drawing. */
  cue?: string;
};

const STAND: Pose = {
  torso: 180,
  arm: [
    [0, 0],
    [0, 0],
  ],
  leg: [
    [0, 0],
    [0, 0],
  ],
};
const stand = (p: Partial<Pose>): Pose => ({ ...STAND, ...p });
const FLOOR = GROUND - 1.5;

const squatBottom = (arm: Pose["arm"], torso = 140): Pose => ({
  torso,
  arm,
  leg: [
    [82, -28],
    [78, -30],
  ],
  foot: [90, 90],
});

const FIGURES: Record<string, Figure> = {
  "back squat": {
    view: "side",
    anchor: { on: "feet", x: 58 },
    frames: [
      stand({
        arm: [
          [-35, 150],
          [-30, 150],
        ],
      }),
      squatBottom([
        [-5, 175],
        [0, 175],
      ]),
    ],
    props: [{ kind: "barbell", at: "back" }],
    focus: ["thigh", "torso"],
    cue: "Sit down between your heels, chest up, then drive the floor away.",
  },
  "goblet squat": {
    view: "side",
    anchor: { on: "feet", x: 58 },
    frames: [
      stand({
        arm: [
          [25, 165],
          [20, 165],
        ],
      }),
      squatBottom(
        [
          [60, 175],
          [55, 175],
        ],
        152,
      ),
    ],
    props: [{ kind: "kettlebell", at: "hands" }],
    focus: ["thigh"],
    cue: "Hold the bell at your chest and sit tall between your knees.",
  },
  "romanian deadlift": {
    view: "side",
    anchor: { on: "feet", x: 62 },
    frames: [
      stand({}),
      {
        torso: 100,
        arm: [
          [8, 6],
          [5, 4],
        ],
        leg: [
          [-14, 6],
          [-16, 6],
        ],
      },
    ],
    props: [{ kind: "barbell", at: "hands" }],
    focus: ["thigh", "torso"],
    cue: "Push your hips back with soft knees until you feel the hamstrings.",
  },
  "walking lunge": {
    view: "side",
    anchor: { on: "feet", x: 58 },
    frames: [
      stand({}),
      stand({
        leg: [
          [88, 0],
          [-28, -100],
        ],
        foot: [90, 175],
      }),
    ],
    focus: ["thigh"],
    cue: "Long step, back knee just above the floor, front shin tall.",
  },
  "push-up": {
    view: "side",
    anchor: { on: "hands", at: [78, FLOOR] },
    frames: [
      {
        torso: 103,
        arm: [
          [0, 0],
          [0, 0],
        ],
        leg: [
          [-77, -77],
          [-77, -77],
        ],
        foot: [-10, -10],
        head: 0,
      },
      {
        torso: 93,
        arm: [
          [-128, 6],
          [-128, 6],
        ],
        leg: [
          [-87, -87],
          [-87, -87],
        ],
        foot: [-10, -10],
      },
    ],
    focus: ["upper", "fore", "torso"],
    cue: "Body in one straight line; chest to an inch off the floor.",
  },
  "pull-up": {
    view: "side",
    anchor: { on: "hands", at: [60, 12] },
    props: [{ kind: "bar", x1: 38, x2: 82, y: 12 }],
    frames: [
      stand({
        arm: [
          [180, 180],
          [180, 180],
        ],
        leg: [
          [5, -25],
          [0, -25],
        ],
      }),
      stand({
        arm: [
          [35, 172],
          [30, 172],
        ],
        leg: [
          [10, -30],
          [5, -30],
        ],
      }),
    ],
    focus: ["upper", "torso"],
    cue: "Pull your elbows to your ribs until your chin clears the bar.",
  },
  "band pull-apart": {
    view: "front",
    anchor: { on: "feet", x: 60 },
    frames: [
      stand({
        arm: [
          [90, 90],
          [-90, -90],
        ],
        reach: [0.24, 0.24],
      }),
      stand({
        arm: [
          [-90, -90],
          [90, 90],
        ],
      }),
    ],
    props: [{ kind: "band", from: "hands" }],
    focus: ["upper", "torso"],
    cue: "Arms straight at shoulder height; pull the band to your chest.",
  },
  "band external rotation": {
    view: "front",
    anchor: { on: "feet", x: 52 },
    frames: [
      stand({
        arm: [
          [-4, 90],
          [0, 0],
        ],
      }),
      stand({
        arm: [
          [-4, -90],
          [0, 0],
        ],
      }),
    ],
    props: [
      { kind: "post", x: 100, top: 52 },
      { kind: "band", from: "nearHand", to: [100, 54] },
    ],
    focus: ["upper"],
    cue: "Elbow pinned to your side; rotate the hand out, slow on the way back.",
  },
  "90/90 band external rotation": {
    view: "front",
    anchor: { on: "feet", x: 52 },
    frames: [
      stand({
        arm: [
          [-90, 90],
          [0, 0],
        ],
        reach: [1, 0.55],
      }),
      stand({
        arm: [
          [-90, 180],
          [0, 0],
        ],
      }),
    ],
    props: [
      { kind: "post", x: 100, top: 30 },
      { kind: "band", from: "nearHand", to: [100, 32] },
    ],
    focus: ["upper"],
    cue: "Elbow at shoulder height and bent 90°; rotate the hand up and back.",
  },
  "jaeger band forward fly": {
    view: "front",
    anchor: { on: "feet", x: 60 },
    frames: [
      stand({
        arm: [
          [-90, -90],
          [90, 90],
        ],
      }),
      stand({
        arm: [
          [90, 90],
          [-90, -90],
        ],
        reach: [0.24, 0.24],
      }),
    ],
    props: [{ kind: "band", from: "hands", to: [60, 36] }],
    focus: ["upper", "torso"],
    cue: "Band behind you; bring straight arms together in front.",
  },
  "jaeger band reverse fly": {
    view: "front",
    anchor: { on: "feet", x: 60 },
    frames: [
      stand({
        arm: [
          [90, 90],
          [-90, -90],
        ],
        reach: [0.24, 0.24],
      }),
      stand({
        arm: [
          [-90, -90],
          [90, 90],
        ],
      }),
    ],
    props: [{ kind: "band", from: "hands", to: [60, 36] }],
    focus: ["upper", "torso"],
    cue: "Facing the anchor, open straight arms out to a T and squeeze.",
  },
  "jaeger band throwing deceleration": {
    view: "side",
    anchor: { on: "feet", x: 66 },
    frames: [
      stand({
        torso: 175,
        arm: [
          [150, 175],
          [-20, -10],
        ],
        leg: [
          [25, 0],
          [-15, -5],
        ],
      }),
      stand({
        torso: 140,
        arm: [
          [30, 15],
          [-40, -30],
        ],
        leg: [
          [40, -10],
          [-25, -20],
        ],
      }),
    ],
    props: [
      { kind: "post", x: 14, top: 30 },
      { kind: "band", from: "nearHand", to: [14, 32] },
    ],
    focus: ["upper", "fore"],
    cue: "Band behind you; finish your throw and control the band back.",
  },
  "jaeger band throwing acceleration": {
    view: "side",
    anchor: { on: "feet", x: 62 },
    frames: [
      stand({
        torso: 185,
        arm: [
          [-110, 175],
          [70, 80],
        ],
        leg: [
          [25, 0],
          [-15, -5],
        ],
      }),
      stand({
        torso: 160,
        arm: [
          [115, 105],
          [-30, -20],
        ],
        leg: [
          [30, -5],
          [-20, -10],
        ],
      }),
    ],
    props: [
      { kind: "post", x: 12, top: 30 },
      { kind: "band", from: "nearHand", to: [12, 32] },
    ],
    focus: ["upper", "fore"],
    cue: "Band behind you; from a high cocked arm, drive it through to release.",
  },
  "prone y raise": {
    view: "side",
    anchor: { on: "hip", at: [36, 52] },
    frames: [
      {
        torso: 92,
        arm: [
          [2, 0],
          [0, 0],
        ],
        leg: [
          [-88, -88],
          [-88, -88],
        ],
        foot: [-5, -5],
      },
      {
        torso: 92,
        arm: [
          [118, 118],
          [115, 115],
        ],
        leg: [
          [-88, -88],
          [-88, -88],
        ],
        foot: [-5, -5],
      },
    ],
    props: [{ kind: "bench", x: 4, y: 55, w: 50, h: 6 }],
    focus: ["upper", "torso"],
    cue: "Lying face down, thumbs up; lift your arms into a Y.",
  },
  "med ball rotational scoop toss": {
    view: "side",
    anchor: { on: "feet", x: 56 },
    frames: [
      stand({
        torso: 160,
        arm: [
          [-35, -20],
          [-30, -15],
        ],
        leg: [
          [30, -15],
          [-15, -20],
        ],
      }),
      stand({
        torso: 178,
        arm: [
          [115, 115],
          [110, 110],
        ],
        leg: [
          [15, -5],
          [-25, -25],
        ],
        foot: [90, 160],
      }),
    ],
    props: [{ kind: "medball", at: "hands" }],
    focus: ["torso", "thigh"],
    cue: "Load the back hip, then turn hard and throw through the wall.",
  },
  "long toss": {
    view: "side",
    anchor: { on: "feet", x: 56 },
    frames: [
      stand({
        torso: 190,
        arm: [
          [-115, 160],
          [80, 90],
        ],
        leg: [
          [30, 0],
          [-20, -5],
        ],
      }),
      stand({
        torso: 150,
        arm: [
          [80, 60],
          [-40, -30],
        ],
        leg: [
          [45, -10],
          [-30, -40],
        ],
        foot: [90, 160],
      }),
    ],
    props: [{ kind: "ball", at: "nearHand" }],
    focus: ["upper", "fore", "torso"],
    cue: "Stay on line, get behind the ball and let it carry.",
  },
  "glute bridge": {
    view: "side",
    anchor: { on: "hip", at: [52, 82] },
    frames: [
      {
        torso: -90,
        arm: [
          [-85, -85],
          [-85, -85],
        ],
        leg: [
          [130, 20],
          [130, 20],
        ],
        foot: [90, 90],
      },
      {
        torso: -75,
        arm: [
          [-70, -70],
          [-70, -70],
        ],
        leg: [
          [105, 0],
          [105, 0],
        ],
        foot: [90, 90],
      },
    ],
    focus: ["thigh", "torso"],
    cue: "Feet flat, squeeze your glutes and lift hips to a straight line.",
  },
};

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Close enough for coaches' own exercises ("Band ER", "DB goblet squat"…). */
const KEYWORDS: [RegExp, string][] = [
  [/goblet squat/, "goblet squat"],
  [/\b(back|barbell) squat\b/, "back squat"],
  [/^(?!.*single).*(rdl|romanian)/, "romanian deadlift"],
  [/^(?!.*(lateral|side)).*lunge/, "walking lunge"],
  [/^(?!.*(scap|plyo|clap)).*push-?up/, "push-up"],
  [/(pull|chin)-?up/, "pull-up"],
  [/pull-?apart/, "band pull-apart"],
  [/^(?!.*(prone|side|lying)).*(90\/90|90-90).*(\ber\b|external)/, "90/90 band external rotation"],
  [
    /^(?!.*(prone|side|lying|90)).*(band|cable|tube).*(\ber\b|external rotation)/,
    "band external rotation",
  ],
  [/forward fly/, "jaeger band forward fly"],
  [/reverse fly/, "jaeger band reverse fly"],
  [/(throwing )?decel/, "jaeger band throwing deceleration"],
  [/(throwing )?accel/, "jaeger band throwing acceleration"],
  [/\by raise\b/, "prone y raise"],
  [/scoop toss/, "med ball rotational scoop toss"],
  [/(long toss|catch play|flat ground)/, "long toss"],
  [/(glute bridge|hip thrust)/, "glute bridge"],
];

export function figureFor(name: string): Figure | null {
  const n = norm(name);
  if (FIGURES[n]) return FIGURES[n];
  const hit = KEYWORDS.find(([re]) => re.test(n));
  return hit ? FIGURES[hit[1]] : null;
}

export const FIGURE_NAMES = Object.keys(FIGURES);
