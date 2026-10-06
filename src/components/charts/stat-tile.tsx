import { formatMetric, METRIC_BY_KEY } from "@/constants/metrics";
import { cn } from "@/lib/utils";

/** Metric stat tile: label, latest value, change vs previous test, and a sparkline. */
export function MetricTile({
  metricKey,
  points,
  selected,
  href,
}: {
  metricKey: string;
  points: { date: string; value: number }[];
  selected?: boolean;
  href?: string;
}) {
  const m = METRIC_BY_KEY.get(metricKey);
  if (!m || points.length === 0) return null;
  const data = points.toSorted((a, b) => a.date.localeCompare(b.date));
  const last = data.at(-1)!;
  const prev = data.at(-2);
  const diff = prev ? last.value - prev.value : 0;
  const good = m.better === "higher" ? diff > 0 : diff < 0;

  const body = (
    <>
      <p className="text-xs font-medium text-zinc-500">{m.label}</p>
      <p className="mt-0.5 text-2xl font-semibold text-zinc-900">
        {formatMetric(m.key, last.value)}
      </p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="text-xs text-zinc-500">
          {prev ? (
            diff === 0 ? (
              "No change"
            ) : (
              <span className={good ? "font-medium text-brand-700" : "font-medium text-red-700"}>
                {diff > 0 ? "▲" : "▼"} {Math.abs(diff).toFixed(m.decimals)} {m.unit}
              </span>
            )
          ) : (
            "First test"
          )}
        </p>
        <Sparkline values={data.map((p) => p.value)} />
      </div>
    </>
  );

  const className = cn(
    "block rounded-xl bg-white p-4 ring-1",
    selected ? "ring-2 ring-brand-600" : "ring-zinc-200",
    href && "hover:ring-brand-500",
  );
  return href ? (
    <a href={href} className={className} aria-current={selected ? "true" : undefined}>
      {body}
    </a>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** 12-point max sparkline in a de-emphasis gray, latest point in the accent. */
function Sparkline({ values }: { values: number[] }) {
  const v = values.slice(-12);
  if (v.length < 2) return null;
  const w = 72;
  const h = 24;
  const min = Math.min(...v);
  const max = Math.max(...v);
  const px = (i: number) => 2 + (i / (v.length - 1)) * (w - 4);
  const py = (n: number) => 2 + (1 - (n - min) / (max - min || 1)) * (h - 4);
  return (
    <svg width={w} height={h} aria-hidden className="shrink-0">
      <path
        d={v.map((n, i) => `${i ? "L" : "M"}${px(i)},${py(n)}`).join(" ")}
        fill="none"
        stroke="#a1a1aa"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={px(v.length - 1)}
        cy={py(v.at(-1)!)}
        r={3}
        fill="#039855"
        stroke="#fff"
        strokeWidth={1.5}
      />
    </svg>
  );
}
