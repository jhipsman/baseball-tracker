"use client";

import { useId } from "react";
import type { Base, Bases, FieldLocation } from "@/lib/live/runners";
import { baseLabel } from "@/lib/live/runners";
import styles from "./scoring-workspace.module.css";

const FIELDERS = [
  ["LF", 173, 162],
  ["CF", 320, 113],
  ["RF", 467, 162],
  ["SS", 265, 248],
  ["2B", 381, 248],
  ["3B", 167, 336],
  ["1B", 473, 336],
  ["P", 320, 332],
  ["C", 320, 468],
] as const;
const COORDINATES: Record<Base, { x: number; y: number }> = {
  1: { x: 444, y: 314 },
  2: { x: 320, y: 190 },
  3: { x: 196, y: 314 },
};
export function BaseballDiamond({
  bases,
  known,
  name,
  location,
  choosingLocation,
  onLocation,
  onBase,
  disabled,
  provisional,
}: {
  bases: Bases;
  known: boolean;
  name: (id: string) => string;
  location?: FieldLocation;
  choosingLocation?: boolean;
  onLocation?: (p: FieldLocation) => void;
  onBase?: (base: Base) => void;
  disabled?: boolean;
  provisional?: boolean;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  function clickLocation(event: React.MouseEvent<SVGSVGElement>) {
    if (!choosingLocation || disabled) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onLocation?.({
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    });
  }
  return (
    <div
      className={`${styles.field} ${choosingLocation ? styles.aiming : ""}`}
      data-testid="baseball-field"
    >
      <div className={styles.fieldTop}>
        <span>
          {choosingLocation
            ? "TAP WHERE THE BALL WAS FIELDED"
            : provisional
              ? "PREVIEWING RUNNER OUTCOMES"
              : "THE FIELD"}
        </span>
        <span>{choosingLocation ? "●  LOCATION" : "LIVE DIAMOND"}</span>
      </div>
      <svg
        viewBox="0 0 640 500"
        className={styles.fieldSvg}
        onClick={clickLocation}
        role="img"
        aria-label="Baseball field"
        data-testid="field-location-picker"
      >
        <defs>
          <linearGradient id={`${uid}grass`} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#4b945e" />
            <stop offset="1" stopColor="#286b46" />
          </linearGradient>
          <pattern id={`${uid}stripes`} width="640" height="64" patternUnits="userSpaceOnUse">
            <rect width="640" height="32" fill="#ffffff" opacity=".045" />
          </pattern>
          <clipPath id={`${uid}clip`}>
            <path d="M320 444 52 190A342 342 0 0 1 588 190Z" />
          </clipPath>
          <filter id={`${uid}shadow`}>
            <feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity=".15" />
          </filter>
        </defs>
        <path d="M320 461 25 180A381 381 0 0 1 615 180Z" fill="#d4e1d2" />
        <path d="M320 452 39 186A360 360 0 0 1 601 186Z" fill="#1e563c" />
        <g clipPath={`url(#${uid}clip)`}>
          <rect width="640" height="500" fill={`url(#${uid}grass)`} />
          <rect width="640" height="500" fill={`url(#${uid}stripes)`} />
          <path d="M320 444 166 290Q320 130 474 290Z" fill="#ca9d71" />
          <path d="m320 408-112-112 112-111 112 111Z" fill="#398152" />
          <path
            d="m320 432-124-118 124-124 124 124Z"
            fill="none"
            stroke="#e6cfaf"
            strokeWidth="12"
            strokeLinejoin="round"
          />
          <path
            d="m320 432-124-118 124-124 124 124Z"
            fill="none"
            stroke="#fff9e9"
            strokeWidth="1.5"
            opacity=".9"
          />
          <circle cx="320" cy="329" r="20" fill="#ca9d71" />
          <rect x="313" y="326" width="14" height="4" rx="1" fill="#fffbed" />
          <circle cx="320" cy="440" r="29" fill="#ca9d71" />
          <path d="M320 444 46 184M320 444 594 184" stroke="#f6f2da" strokeWidth="2" />
          <path
            d="M66 182A331 331 0 0 1 574 182"
            fill="none"
            stroke="#abc994"
            strokeWidth="2"
            strokeDasharray="4 7"
            opacity=".5"
          />
        </g>
        <path d="m313 433h14v9l-7 6-7-6Z" fill="#fffbed" />
        <g fill="#d0e4c3" opacity=".65" fontSize="11" fontFamily="system-ui" textAnchor="middle">
          <text x="320" y="62">
            CENTER FIELD
          </text>
          <text x="116" y="174" transform="rotate(-35 116 174)">
            LEFT FIELD
          </text>
          <text x="524" y="174" transform="rotate(35 524 174)">
            RIGHT FIELD
          </text>
        </g>
        {location && (
          <g filter={`url(#${uid}shadow)`}>
            <path
              d={`M320 438Q${location.x * 640} 360 ${location.x * 640} ${location.y * 500}`}
              fill="none"
              stroke="#f9e17f"
              strokeWidth="2.5"
              strokeDasharray="6 5"
            />
            <circle
              cx={location.x * 640}
              cy={location.y * 500}
              r="14"
              fill="#f5df79"
              fillOpacity=".25"
              stroke="#ffef9b"
              strokeWidth="2"
            />
            <circle cx={location.x * 640} cy={location.y * 500} r="4" fill="#fff6c8" />
          </g>
        )}
      </svg>
      {FIELDERS.map(([position, x, y]) => (
        <button
          key={position}
          type="button"
          className={styles.fielder}
          style={{ left: `${x / 6.4}%`, top: `${y / 5}%` }}
          disabled={!choosingLocation || disabled}
          onClick={() => onLocation?.({ x: x / 640, y: y / 500 })}
          aria-label={`Ball fielded at ${position}`}
        >
          {position}
        </button>
      ))}
      {([1, 2, 3] as Base[]).map((base) => {
        const at = COORDINATES[base],
          id = known ? bases[base] : null;
        return (
          <button
            key={base}
            type="button"
            className={`${styles.base} ${id ? styles.occupied : ""}`}
            style={{ left: `${at.x / 6.4}%`, top: `${at.y / 5}%` }}
            disabled={disabled || choosingLocation}
            onClick={() => onBase?.(base)}
            aria-label={
              id
                ? `${name(id)} on ${baseLabel(base).toLowerCase()} base`
                : `${baseLabel(base)} base, ${known ? "empty" : "unknown"}`
            }
            data-testid={`base-${base}`}
          >
            <span className={styles.baseBag} />
            <span className={styles.runnerLabel}>
              {id ? name(id).split(" ")[0] : known ? `${base}B` : "?"}
            </span>
          </button>
        );
      })}
      {!known && (
        <div className={styles.basesUnknown}>Set the bases to pick up where you left off</div>
      )}
    </div>
  );
}
