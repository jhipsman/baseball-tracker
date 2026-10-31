/**
 * Small, static product previews for the homepage, drawn with the app's own
 * tokens so they match Day and Night and stay sharp at any size.
 */
import { cn } from "@/lib/utils";

function Frame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "rounded-3xl bg-surface p-3 shadow-xl ring-1 shadow-zinc-900/10 ring-zinc-200 sm:p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function LiveMock() {
  return (
    <Frame className="space-y-3">
      <div className="hero rounded-2xl p-4">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-0.5">
            <span className="live-dot" /> LIVE
          </span>
          <span className="text-white/70">Bot 5 · 1 out</span>
        </div>
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div>
            <p className="text-sm text-white/70">Rays</p>
            <p className="text-4xl font-bold tabular-nums">4</p>
          </div>
          <span className="text-xs text-white/50">vs</span>
          <div className="text-right">
            <p className="text-sm text-white/70">Hawks</p>
            <p className="text-4xl font-bold tabular-nums">2</p>
          </div>
        </div>
        <div className="mt-3 flex gap-4 text-xs font-semibold text-white/80">
          {[
            ["B", 2, 3],
            ["S", 1, 2],
            ["O", 1, 2],
          ].map(([l, on, max]) => (
            <span key={l as string} className="flex items-center gap-1">
              {l}
              {Array.from({ length: max as number }, (_, i) => (
                <i
                  key={i}
                  className={cn(
                    "size-2 rounded-full",
                    i < (on as number) ? "bg-amber-300" : "bg-white/20",
                  )}
                />
              ))}
            </span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-5 gap-1.5 text-center text-[11px] font-medium">
        {[
          ["B", "Ball"],
          ["Ꝁ", "Looking"],
          ["K", "Swinging"],
          ["F", "Foul"],
        ].map(([s, l]) => (
          <span key={l} className="rounded-xl py-2 ring-1 ring-zinc-200">
            <b className="block text-lg">{s}</b>
            {l}
          </span>
        ))}
        <span className="rounded-xl bg-brand-700 py-2 text-on-brand">
          <b className="block text-lg">⚾</b>In play
        </span>
      </div>
      <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-900">
        <b>Lucas:</b> double to left · 2 RBI
      </p>
    </Frame>
  );
}

export function HealthMock() {
  const rows = [
    ["⚠", "Noah P.", "Sore 2× this week", "bg-amber-100 text-amber-900"],
    ["⏸", "Mateo A.", "Rest until Tue", "bg-sky-100 text-sky-900"],
    ["✓", "Owen W.", "Up to 85 pitches today", "bg-brand-100 text-brand-900"],
    ["✓", "Ethan B.", "Up to 75 pitches today", "bg-brand-100 text-brand-900"],
  ];
  return (
    <Frame className="space-y-2">
      <div className="flex items-baseline justify-between px-1">
        <p className="font-semibold">Today</p>
        <p className="text-xs text-zinc-500">11 of 12 arm check-ins</p>
      </div>
      {rows.map(([icon, name, detail, tone]) => (
        <div key={name} className="flex items-center gap-3 rounded-2xl p-2.5 ring-1 ring-zinc-200">
          <span className={cn("grid size-8 place-items-center rounded-full font-bold", tone)}>
            {icon}
          </span>
          <span className="min-w-0 flex-1">
            <b className="block text-sm">{name}</b>
            <span className="block truncate text-xs text-zinc-600">{detail}</span>
          </span>
        </div>
      ))}
    </Frame>
  );
}

export function TrainingMock() {
  return (
    <Frame className="space-y-3">
      <div className="hero rounded-2xl p-4">
        <p className="text-xs font-semibold text-white/70">TODAY · WEEK 3 OF 6</p>
        <p className="mt-1 text-xl font-semibold">Lower body + arm care</p>
        <p className="text-sm text-white/70">6 exercises · about 45 min</p>
      </div>
      {[
        ["Trap bar deadlift", "4 × 5 · last time 185 lb"],
        ["J-band series", "1 round"],
        ["Long toss", "20 throws @ 120 ft"],
      ].map(([n, d], i) => (
        <div key={n} className="flex items-center gap-3 px-1">
          <span
            className={cn(
              "grid size-6 place-items-center rounded-full text-xs font-bold",
              i === 0 ? "bg-brand-600 text-on-brand" : "ring-1 ring-zinc-300",
            )}
          >
            {i === 0 ? "✓" : i + 1}
          </span>
          <span className="text-sm">
            <b className="block">{n}</b>
            <span className="text-zinc-600">{d}</span>
          </span>
        </div>
      ))}
    </Frame>
  );
}

export function ScheduleMock() {
  return (
    <Frame className="space-y-2">
      {[
        ["SAT", "11", "vs Lakeside Hawks", "10:00 AM · Riverside Field 1", "14 going"],
        ["TUE", "14", "Practice", "5:30 PM · Hitting + defense", "12 going"],
        ["FRI", "17", "@ North Valley", "6:00 PM · Tournament", "RSVP"],
      ].map(([d, n, t, s, r]) => (
        <div key={t} className="flex items-center gap-3 rounded-2xl p-2.5 ring-1 ring-zinc-200">
          <span className="w-11 text-center">
            <span className="block text-[10px] font-semibold text-zinc-500">{d}</span>
            <span className="block text-xl font-bold leading-none">{n}</span>
          </span>
          <span className="min-w-0 flex-1">
            <b className="block truncate text-sm">{t}</b>
            <span className="block truncate text-xs text-zinc-600">{s}</span>
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-semibold",
              r === "RSVP" ? "bg-zinc-900 text-zinc-50" : "bg-brand-100 text-brand-900",
            )}
          >
            {r}
          </span>
        </div>
      ))}
      <div className="rounded-2xl bg-zinc-50 p-3 text-sm">
        <b>Coach Rivera:</b> Bring white pants Saturday. Bus leaves 8:15.
      </div>
    </Frame>
  );
}

export function PaymentsMock() {
  return (
    <Frame className="space-y-3">
      <div className="px-1">
        <p className="text-xs font-semibold text-zinc-500">SPRING 2027 · 14U</p>
        <p className="text-lg font-semibold">Registration</p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <span className="rounded-xl p-3 ring-1 ring-zinc-200">
          <b className="block">Pay $300 now</b>
          <span className="text-zinc-600">One payment</span>
        </span>
        <span className="rounded-xl bg-brand-50 p-3 ring-2 ring-brand-600">
          <b className="block">3 payments</b>
          <span className="text-zinc-600">$100 a month</span>
        </span>
      </div>
      <div className="flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2 text-sm">
        <span>Waiver signed · Pam Parent</span>
        <span className="font-semibold text-brand-700">✓</span>
      </div>
      <div className="rounded-xl bg-zinc-900 px-3 py-2.5 text-center text-sm font-semibold text-zinc-50">
        Pay by bank account or card
      </div>
    </Frame>
  );
}
