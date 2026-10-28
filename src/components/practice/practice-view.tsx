import {
  blockTimes,
  formatDuration,
  formatPracticeDate,
  KIND_INFO,
  practiceRange,
  totalMinutes,
  type PracticePlan,
} from "@/lib/practices";
import { cn } from "@/lib/utils";

/** Header facts for a plan: date, time range, location, group. */
export function PracticeMeta({ plan }: { plan: PracticePlan }) {
  const total = totalMinutes(plan.blocks);
  const range = practiceRange(plan.startTime, total);
  return (
    <dl className="mt-2 grid gap-1 text-sm text-zinc-700">
      {plan.date ? (
        <div className="flex gap-2">
          <dt className="sr-only">Date</dt>
          <dd className="font-medium">
            {formatPracticeDate(plan.date, { weekday: "long", month: "long" })}
          </dd>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-x-2">
        <dt className="sr-only">Time</dt>
        <dd>
          {range ?? "Time TBA"}
          {total > 0 ? <span className="text-zinc-500"> · {formatDuration(total)}</span> : null}
        </dd>
      </div>
      {plan.location ? (
        <div className="flex gap-2">
          <dt className="sr-only">Location</dt>
          <dd>📍 {plan.location}</dd>
        </div>
      ) : null}
      <div className="flex gap-2">
        <dt className="sr-only">Who</dt>
        <dd className="text-zinc-500">
          {plan.groupName ? `${plan.groupName} only` : "Whole team"}
        </dd>
      </div>
    </dl>
  );
}

/** Read-only, phone-first practice plan: header, notes, timeline of blocks. */
export function PracticeView({ plan }: { plan: PracticePlan }) {
  const times = blockTimes(plan.startTime, plan.blocks);
  return (
    <article className="space-y-5">
      <header>
        <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">Practice</p>
        <h1 className="text-2xl font-semibold tracking-tight">{plan.title}</h1>
        <PracticeMeta plan={plan} />
      </header>

      {plan.notes ? (
        <section className="rounded-xl bg-amber-50 p-4 text-sm whitespace-pre-line text-amber-950 ring-1 ring-amber-200">
          <h2 className="mb-1 font-semibold">Coach notes</h2>
          {plan.notes}
        </section>
      ) : null}

      {plan.blocks.length === 0 ? (
        <p className="rounded-xl bg-white p-6 text-center text-sm text-zinc-500 ring-1 ring-zinc-200">
          The schedule for this practice hasn&apos;t been posted yet.
        </p>
      ) : (
        <ol className="relative space-y-3 before:absolute before:top-2 before:bottom-2 before:left-[4.6rem] before:w-px before:bg-zinc-200">
          {plan.blocks.map((b, i) => {
            const kind = KIND_INFO[b.kind];
            return (
              <li key={b.id} className="relative flex gap-3">
                <div className="w-16 shrink-0 pt-3 text-right text-xs font-semibold text-zinc-600 tabular-nums">
                  {times[i].label.split("–")[0]}
                  <span className="block font-normal text-zinc-400">{b.durationMin} min</span>
                </div>
                <span
                  aria-hidden
                  className={cn(
                    "relative z-10 mt-4 size-3 shrink-0 rounded-full ring-4 ring-zinc-50",
                    kind.dot,
                  )}
                />
                <div className="min-w-0 flex-1 rounded-xl bg-white p-3 ring-1 ring-zinc-200">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <h3 className="font-semibold">{b.title}</h3>
                    <span className="text-xs text-zinc-500 tabular-nums">{times[i].label}</span>
                  </div>
                  <span
                    className={cn(
                      "mt-1 inline-block rounded px-1.5 py-0.5 text-[11px] font-medium",
                      kind.soft,
                    )}
                  >
                    {kind.label}
                  </span>
                  {b.details ? (
                    <p className="mt-2 text-sm whitespace-pre-line text-zinc-700">{b.details}</p>
                  ) : null}
                  {b.stations.length > 0 ? (
                    <ul className="mt-2 grid gap-1.5">
                      {b.stations.map((s, si) => (
                        <li key={si} className="rounded-lg bg-zinc-50 px-3 py-2 text-sm">
                          <span className="font-medium">{s.name}</span>
                          {s.coach ? <span className="text-zinc-500"> · {s.coach}</span> : null}
                          {s.detail ? (
                            <span className="block text-xs text-zinc-600">{s.detail}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </article>
  );
}
