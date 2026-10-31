"use client";

import { BODY_PART } from "@/lib/health";
import { cn } from "@/lib/utils";

/** A spot on the body: "chest", or a sided part like "knee:left". */
export type Spot = string;

export function spotLabel(spot: Spot): string {
  const [part, side] = spot.split(":");
  const label = BODY_PART[part]?.label ?? part;
  return side ? `${side[0].toUpperCase()}${side.slice(1)} ${label.toLowerCase()}` : label;
}

type Shape =
  | { kind: "circle"; cx: number; cy: number; r: number }
  | { kind: "rect"; x: number; y: number; w: number; h: number; rx?: number };

/** Front view, drawn facing you: the player's right is on the viewer's left. */
const FRONT: { part: string; side?: "left" | "right"; shape: Shape }[] = [
  { part: "head", shape: { kind: "circle", cx: 100, cy: 30, r: 21 } },
  { part: "neck", shape: { kind: "rect", x: 90, y: 52, w: 20, h: 12, rx: 4 } },
  { part: "chest", shape: { kind: "rect", x: 74, y: 66, w: 52, h: 40, rx: 10 } },
  { part: "abs", shape: { kind: "rect", x: 78, y: 108, w: 44, h: 42, rx: 10 } },
  ...(["right", "left"] as const).flatMap((side) => {
    const m = side === "right" ? -1 : 1; // player's right is on the viewer's left
    const x = (dx: number) => 100 + m * dx;
    return [
      { part: "shoulder", side, shape: { kind: "circle", cx: x(38), cy: 76, r: 13 } as Shape },
      { part: "elbow", side, shape: { kind: "circle", cx: x(48), cy: 132, r: 10 } as Shape },
      {
        part: "forearm",
        side,
        shape: { kind: "rect", x: x(52) - 8, y: 144, w: 16, h: 40, rx: 8 } as Shape,
      },
      { part: "hand", side, shape: { kind: "circle", cx: x(54), cy: 198, r: 10 } as Shape },
      {
        part: "hip",
        side,
        shape: { kind: "rect", x: x(12) - 11, y: 152, w: 22, h: 24, rx: 8 } as Shape,
      },
      {
        part: "quad",
        side,
        shape: { kind: "rect", x: x(13) - 11, y: 178, w: 22, h: 60, rx: 10 } as Shape,
      },
      { part: "knee", side, shape: { kind: "circle", cx: x(13), cy: 250, r: 11 } as Shape },
      {
        part: "shin",
        side,
        shape: { kind: "rect", x: x(13) - 9, y: 263, w: 18, h: 62, rx: 8 } as Shape,
      },
      {
        part: "ankle",
        side,
        shape: { kind: "rect", x: x(13) - 12, y: 328, w: 24, h: 14, rx: 7 } as Shape,
      },
    ];
  }),
];

const BACK_PART: Record<string, string> = {
  chest: "upper_back",
  abs: "lower_back",
  quad: "hamstring",
};

/** Back view: same outline, but the player's left is now on the viewer's left. */
const BACK: typeof FRONT = FRONT.map((r) => ({
  part: BACK_PART[r.part] ?? r.part,
  side: r.side === "left" ? "right" : r.side === "right" ? "left" : undefined,
  shape: r.shape,
}));

function ShapeEl({ shape, className }: { shape: Shape; className: string }) {
  return shape.kind === "circle" ? (
    <circle cx={shape.cx} cy={shape.cy} r={shape.r} className={className} />
  ) : (
    <rect
      x={shape.x}
      y={shape.y}
      width={shape.w}
      height={shape.h}
      rx={shape.rx ?? 6}
      className={className}
    />
  );
}

/**
 * Tap where it hurts. Front and back outlines; each area is a toggle button.
 * `selected` spots are highlighted; `onToggle` gets the spot tapped.
 */
export function BodyMap({
  selected,
  onToggle,
  disabled,
  label = "Body map",
}: {
  selected: Spot[];
  onToggle: (spot: Spot) => void;
  disabled?: boolean;
  label?: string;
}) {
  const on = new Set(selected);
  const view = (title: string, regions: typeof FRONT, leftLabel: string, rightLabel: string) => (
    <figure className="flex flex-col items-center">
      <svg
        viewBox="0 0 200 350"
        className="h-64 w-auto touch-manipulation sm:h-72"
        role="group"
        aria-label={`${label}: ${title}`}
      >
        <text x="14" y="18" className="fill-zinc-400 text-[11px] font-semibold">
          {leftLabel}
        </text>
        <text x="186" y="18" textAnchor="end" className="fill-zinc-400 text-[11px] font-semibold">
          {rightLabel}
        </text>
        {regions.map((r) => {
          const spot = r.side ? `${r.part}:${r.side}` : r.part;
          const active = on.has(spot);
          return (
            <g
              key={spot}
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-pressed={active}
              aria-label={spotLabel(spot)}
              data-spot={spot}
              onClick={() => !disabled && onToggle(spot)}
              onKeyDown={(e) => {
                if (disabled || (e.key !== "Enter" && e.key !== " ")) return;
                e.preventDefault();
                onToggle(spot);
              }}
              className={cn(
                "outline-none focus-visible:[&>*]:stroke-brand-600 focus-visible:[&>*]:stroke-[3]",
                disabled ? "cursor-default" : "cursor-pointer",
              )}
            >
              <title>{spotLabel(spot)}</title>
              <ShapeEl
                shape={r.shape}
                className={cn(
                  "stroke-2 transition-colors",
                  active
                    ? "fill-red-500 stroke-red-700"
                    : "fill-zinc-200 stroke-zinc-300 hover:fill-zinc-300",
                )}
              />
            </g>
          );
        })}
      </svg>
      <figcaption className="text-xs font-semibold text-zinc-500">{title}</figcaption>
    </figure>
  );
  return (
    <div className="flex justify-center gap-2 sm:gap-6">
      {view("Front", FRONT, "R", "L")}
      {view("Back", BACK, "L", "R")}
    </div>
  );
}
