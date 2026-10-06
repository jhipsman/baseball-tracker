"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatMetric, METRIC_BY_KEY } from "@/constants/metrics";

export type MetricPoint = { date: string; value: number };

const SERIES = "#039855"; // brand-600, validated against the light surface
const GRID = "#e4e4e7"; // zinc-200 hairline
const SURFACE = "#ffffff";
const HEIGHT = 220;
const PAD = { top: 20, right: 56, bottom: 28, left: 44 };

const DAY = 86_400_000;
const toMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
const fmtDate = (d: string, withYear = false) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });

/** Clean tick values spanning [min, max]. */
function niceTicks(min: number, max: number, count = 4) {
  if (min === max) {
    const pad = Math.abs(min) * 0.05 || 1;
    min -= pad;
    max += pad;
  }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toFixed(6)));
  return { lo, hi, ticks, step };
}

/** Single-series line chart of one metric over time, with crosshair + tooltip. */
export function MetricChart({ metricKey, points }: { metricKey: string; points: MetricPoint[] }) {
  const metric = METRIC_BY_KEY.get(metricKey);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(260, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => points.toSorted((a, b) => a.date.localeCompare(b.date)), [points]);

  const geom = useMemo(() => {
    const values = data.map((p) => p.value);
    const { lo, hi, ticks } = niceTicks(Math.min(...values), Math.max(...values));
    const t0 = toMs(data[0].date);
    const t1 = Math.max(toMs(data.at(-1)!.date), t0 + DAY);
    const innerW = width - PAD.left - PAD.right;
    const innerH = HEIGHT - PAD.top - PAD.bottom;
    const x = (d: string) =>
      data.length === 1 ? PAD.left + innerW / 2 : PAD.left + ((toMs(d) - t0) / (t1 - t0)) * innerW;
    const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo || 1)) * innerH;
    // Same number of decimals on every tick (7.0, 7.1 — not 7, 7.1).
    const tickDecimals = Math.min(
      metric?.decimals ?? 2,
      Math.max(0, ...ticks.map((t) => (String(t).split(".")[1] ?? "").length)),
    );
    return { ticks, x, y, innerW, innerH, tickDecimals };
  }, [data, width, metric]);

  if (!metric || data.length === 0) return null;

  const { ticks, x, y, tickDecimals } = geom;
  const path = data.map((p, i) => `${i ? "L" : "M"}${x(p.date)},${y(p.value)}`).join(" ");
  const bestIndex = data.reduce(
    (best, p, i) =>
      (metric.better === "higher" ? p.value > data[best].value : p.value < data[best].value)
        ? i
        : best,
    0,
  );
  const lastIndex = data.length - 1;
  const xLabels =
    data.length <= 4
      ? data.map((p) => p.date)
      : [data[0].date, data[Math.floor(lastIndex / 2)].date, data[lastIndex].date];

  const nearest = (clientX: number) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    const px = clientX - rect.left;
    let best = 0;
    for (let i = 1; i < data.length; i++) {
      if (Math.abs(x(data[i].date) - px) < Math.abs(x(data[best].date) - px)) best = i;
    }
    return best;
  };

  const a = active != null ? data[active] : null;
  const prev = active != null && active > 0 ? data[active - 1] : null;

  return (
    <div ref={wrapRef} className="relative w-full select-none">
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={`${metric.label} over time, ${data.length} assessments. Latest ${formatMetric(metric.key, data[lastIndex].value)}.`}
        tabIndex={0}
        className="block outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
        onPointerMove={(e) => setActive(nearest(e.clientX))}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive(lastIndex)}
        onBlur={() => setActive(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setActive((i) => Math.max(0, (i ?? lastIndex) - 1));
          if (e.key === "ArrowRight") setActive((i) => Math.min(lastIndex, (i ?? 0) + 1));
        }}
      >
        {/* gridlines + y ticks */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(t)}
              y2={y(t)}
              stroke={GRID}
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={y(t)}
              dy="0.32em"
              textAnchor="end"
              className="fill-zinc-500 text-[11px] tabular-nums"
            >
              {t.toLocaleString("en-US", {
                minimumFractionDigits: tickDecimals,
                maximumFractionDigits: tickDecimals,
              })}
            </text>
          </g>
        ))}
        {/* x labels */}
        {xLabels.map((d, i) => (
          <text
            key={`${d}-${i}`}
            x={x(d)}
            y={HEIGHT - 8}
            textAnchor={
              xLabels.length > 1 && i === 0
                ? "start"
                : xLabels.length > 1 && i === xLabels.length - 1
                  ? "end"
                  : "middle"
            }
            className="fill-zinc-500 text-[11px]"
          >
            {fmtDate(d)}
          </text>
        ))}

        {/* crosshair */}
        {a ? (
          <line
            x1={x(a.date)}
            x2={x(a.date)}
            y1={PAD.top - 8}
            y2={HEIGHT - PAD.bottom}
            stroke="#a1a1aa"
            strokeWidth={1}
          />
        ) : null}

        <path
          d={path}
          fill="none"
          stroke={SERIES}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {data.map((p, i) => (
          <circle
            key={p.date + i}
            cx={x(p.date)}
            cy={y(p.value)}
            r={i === active ? 6 : 4}
            fill={SERIES}
            stroke={SURFACE}
            strokeWidth={2}
          />
        ))}

        {/* selective direct labels: latest, and the best if different */}
        <text
          x={x(data[lastIndex].date) + 10}
          y={y(data[lastIndex].value)}
          dy="0.32em"
          className="fill-zinc-900 text-xs font-semibold"
        >
          {formatMetric(metric.key, data[lastIndex].value)}
        </text>
        {bestIndex !== lastIndex ? (
          <text
            x={x(data[bestIndex].date)}
            y={y(data[bestIndex].value) - 10}
            textAnchor="middle"
            className="fill-zinc-500 text-[11px]"
          >
            Best {formatMetric(metric.key, data[bestIndex].value)}
          </text>
        ) : null}
      </svg>

      {a ? (
        <div
          role="status"
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg bg-white px-3 py-2 text-xs whitespace-nowrap shadow-lg ring-1 ring-zinc-200"
          style={{ left: Math.min(Math.max(x(a.date), 70), width - 70) }}
        >
          <div className="flex items-center gap-2">
            <span aria-hidden className="h-0.5 w-3 rounded" style={{ background: SERIES }} />
            <span className="text-sm font-semibold text-zinc-900">
              {formatMetric(metric.key, a.value)}
            </span>
          </div>
          <div className="mt-0.5 text-zinc-500">
            {fmtDate(a.date, true)}
            {prev ? <Delta metricKey={metric.key} from={prev.value} to={a.value} /> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Delta({ metricKey, from, to }: { metricKey: string; from: number; to: number }) {
  const m = METRIC_BY_KEY.get(metricKey)!;
  const diff = to - from;
  if (diff === 0) return <span> · no change</span>;
  const good = m.better === "higher" ? diff > 0 : diff < 0;
  return (
    <span className={good ? "text-brand-700" : "text-red-700"}>
      {" "}
      · {diff > 0 ? "+" : "−"}
      {Math.abs(diff).toFixed(m.decimals)} {m.unit}
    </span>
  );
}
