"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFormAction } from "@/components/ui/use-form-action";
import {
  addTime,
  clockIn,
  clockOut,
  deleteTime,
  payPeriod,
  reviewTime,
  saveRate,
  submitTime,
  unsubmitTime,
} from "@/lib/staff-actions";
import { hours, PAY_METHODS, PAY_TYPES, type PayType } from "@/lib/staff-pay";
import { cn } from "@/lib/utils";

type R = { error?: string; ok?: string };

async function safe(fn: () => Promise<R>): Promise<R> {
  try {
    return await fn();
  } catch {
    return { error: "That didn't go through. Check your connection and try again." };
  }
}

function Msg({ r }: { r: R }) {
  if (r.error)
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {r.error}
      </p>
    );
  if (r.ok)
    return (
      <p role="status" className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900">
        {r.ok}
      </p>
    );
  return null;
}

/** A button that runs one action and shows its error (or a short confirmation). */
function ActionButton({
  run,
  children,
  pendingLabel,
  variant = "secondary",
  className,
  showOk = false,
}: {
  run: () => Promise<R>;
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  showOk?: boolean;
}) {
  const [r, setR] = useState<R>({});
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        type="button"
        variant={variant}
        className={className}
        disabled={pending}
        onClick={() => start(async () => setR(await safe(run)))}
      >
        {pending ? (pendingLabel ?? "Working…") : children}
      </Button>
      {r.error || (showOk && r.ok) ? <Msg r={r} /> : null}
    </span>
  );
}

/** Running clock (or a big Clock in button). */
export function ClockCard({ startedAt }: { startedAt: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  const [activity, setActivity] = useState("");
  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, [startedAt]);
  if (!startedAt)
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface p-4 ring-1 ring-zinc-200">
        <div>
          <p className="font-semibold">Not clocked in</p>
          <p className="text-sm text-zinc-600">Start the clock when you get to the field.</p>
        </div>
        <ActionButton run={clockIn} variant="primary" pendingLabel="Starting…">
          Clock in
        </ActionButton>
      </div>
    );
  const mins = Math.max(0, Math.round((now - new Date(startedAt).getTime()) / 60000));
  const since = new Date(startedAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <div className="space-y-3 rounded-2xl bg-brand-50 p-4 ring-1 ring-brand-200">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-semibold text-brand-900">
          <span aria-hidden className="mr-1.5 inline-block size-2 rounded-full bg-brand-600" />
          Clocked in since {since}
        </p>
        <p className="text-2xl font-semibold text-brand-900 tabular-nums">{hours(mins)}</p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Field
          label="What was it for? (optional)"
          name="clock-activity"
          value={activity}
          onChange={(e) => setActivity(e.target.value)}
          placeholder="Practice, lessons, field work…"
          maxLength={120}
          className="min-w-0 flex-1"
        />
        <ActionButton run={() => clockOut(activity)} variant="primary" pendingLabel="Stopping…">
          Clock out
        </ActionButton>
      </div>
    </div>
  );
}

export type RecentEvent = {
  id: string;
  kind: "practice" | "game";
  date: string;
  label: string;
  minutes: number;
};

/** Add hours by hand; tapping a recent practice or game fills it in. */
export function AddTimeForm({ today, recent }: { today: string; recent: RecentEvent[] }) {
  const form = useRef<HTMLFormElement>(null);
  const [picked, setPicked] = useState<RecentEvent | null>(null);
  const { state, onSubmit, pending } = useFormAction<R>(async (_prev, fd) => {
    const r = await safe(() => addTime({}, fd));
    if (!r.error) {
      form.current?.reset();
      setPicked(null);
    }
    return r;
  }, {});
  const set = (name: string, value: string) => {
    const el = form.current?.elements.namedItem(name) as HTMLInputElement | null;
    if (el) el.value = value;
  };
  return (
    <form ref={form} onSubmit={onSubmit} className="space-y-4">
      {recent.length ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-800">I worked this</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recent.map((ev) => (
              <button
                key={ev.id}
                type="button"
                aria-pressed={picked?.id === ev.id}
                onClick={() => {
                  setPicked(ev);
                  set("work_date", ev.date);
                  set("activity", ev.label);
                  set("hours", (ev.minutes / 60).toString());
                }}
                className={cn(
                  "shrink-0 rounded-xl px-3 py-2 text-left text-sm ring-1",
                  picked?.id === ev.id
                    ? "bg-brand-50 text-brand-900 ring-brand-300"
                    : "bg-surface ring-zinc-200 hover:bg-zinc-50",
                )}
              >
                <span className="block font-semibold">{ev.label}</span>
                <span className="block text-xs text-zinc-500">
                  {new Date(`${ev.date}T12:00:00Z`).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC",
                  })}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <input
        type="hidden"
        name="practice_id"
        value={picked?.kind === "practice" ? picked.id : ""}
      />
      <input type="hidden" name="game_id" value={picked?.kind === "game" ? picked.id : ""} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Day" name="work_date" type="date" max={today} defaultValue={today} required />
        <Field
          label="How long"
          name="hours"
          inputMode="decimal"
          placeholder="1.5 or 1:30"
          hint="Hours, like 2, 1.5 or 1:30"
          required
        />
        <Field label="What for" name="activity" placeholder="Practice" maxLength={120} />
      </div>
      <Field label="Note (optional)" name="note" maxLength={500} />
      <Msg r={state} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="submit" value="1" pending={pending} pendingLabel="Adding…">
          Add and send for approval
        </SubmitButton>
        <SubmitButton variant="secondary" pending={pending} pendingLabel="Adding…">
          Save for later
        </SubmitButton>
      </div>
    </form>
  );
}

export function SubmitAll({ count }: { count: number }) {
  return (
    <ActionButton run={submitTime} variant="primary" pendingLabel="Sending…" showOk>
      Send {count} for approval
    </ActionButton>
  );
}

export function EntryActions({ id, status }: { id: string; status: string }) {
  return (
    <span className="flex gap-1">
      {status === "submitted" ? (
        <ActionButton run={() => unsubmitTime(id)} variant="ghost" className="h-9 px-3">
          Take back
        </ActionButton>
      ) : null}
      {status === "open" || status === "rejected" ? (
        <ActionButton
          run={() => deleteTime(id)}
          variant="ghost"
          className="h-9 px-3"
          pendingLabel="Removing…"
        >
          Remove
        </ActionButton>
      ) : null}
    </span>
  );
}

/** Approve, or send back with a reason. */
export function ReviewButtons({ ids, label = "Approve" }: { ids: string[]; label?: string }) {
  const [sendingBack, setSendingBack] = useState(false);
  const [note, setNote] = useState("");
  if (sendingBack)
    return (
      <div className="flex w-full flex-wrap items-end gap-2">
        <Field
          label="Why? (they'll see this)"
          name="review-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          placeholder="Practice ended at 7, not 8"
          className="min-w-0 flex-1"
        />
        <ActionButton run={() => reviewTime(ids, false, note)} pendingLabel="Sending…">
          Send back
        </ActionButton>
        <Button type="button" variant="ghost" onClick={() => setSendingBack(false)}>
          Cancel
        </Button>
      </div>
    );
  return (
    <span className="flex flex-wrap gap-2">
      <ActionButton run={() => reviewTime(ids, true)} variant="primary" pendingLabel="Approving…">
        {label}
      </ActionButton>
      <Button type="button" variant="ghost" onClick={() => setSendingBack(true)}>
        Send back
      </Button>
    </span>
  );
}

/** Pay setup for one staff member. */
export function RateForm({
  profileId,
  rate,
}: {
  profileId: string;
  rate: {
    pay_type: PayType;
    rate_cents: number;
    stipend_cents: number;
    stipend_payments: number;
    title: string | null;
  } | null;
}) {
  const [type, setType] = useState<PayType>(rate?.pay_type ?? "hourly");
  const { state, onSubmit, pending } = useFormAction<R>(
    (_prev, fd) => safe(() => saveRate({}, fd)),
    {},
  );
  const dollars = (c: number | undefined) => (c ? (c / 100).toFixed(2) : "");
  const unit = PAY_TYPES.find((p) => p.key === type)?.unit;
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="profile_id" value={profileId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Paid"
          name="pay_type"
          value={type}
          onChange={(e) => setType(e.target.value as PayType)}
        >
          {PAY_TYPES.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </SelectField>
        <Field
          label="Job title (optional)"
          name="title"
          defaultValue={rate?.title ?? ""}
          placeholder="Assistant coach"
          maxLength={80}
        />
        {type === "hourly" || type === "per_session" ? (
          <Field
            label={`Rate (${unit})`}
            name="rate"
            inputMode="decimal"
            placeholder="20.00"
            defaultValue={dollars(rate?.rate_cents)}
          />
        ) : null}
        {type === "stipend" ? (
          <>
            <Field
              label="Season stipend"
              name="stipend"
              inputMode="decimal"
              placeholder="1500.00"
              defaultValue={dollars(rate?.stipend_cents)}
            />
            <Field
              label="Split into payments"
              name="stipend_payments"
              type="number"
              min={1}
              max={52}
              defaultValue={rate?.stipend_payments ?? 1}
              hint="One payment each time you run pay"
            />
          </>
        ) : null}
      </div>
      {type === "volunteer" ? <p className="text-sm text-zinc-600">{unit}.</p> : null}
      <Msg r={state} />
      <SubmitButton variant="secondary" pending={pending} pendingLabel="Saving…">
        Save
      </SubmitButton>
    </form>
  );
}

/** Mark a pay period paid. */
export function PayForm({
  from,
  to,
  payments,
  total,
}: {
  from: string;
  to: string;
  payments: { profileId: string; cents: number }[];
  total: string;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<string>("payroll");
  const [reference, setReference] = useState("");
  const [r, setR] = useState<R>({});
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="How you paid"
          name="method"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
        >
          {PAY_METHODS.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </SelectField>
        <Field
          label="Reference (optional)"
          name="reference"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Check #, payroll run…"
          maxLength={120}
        />
      </div>
      <Msg r={r} />
      <Button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            if (!confirm(`Mark ${total} paid for these dates? Approved time will lock.`)) return;
            const res = await safe(() => payPeriod({ from, to, method, reference, payments }));
            setR(res);
            if (!res.error) router.refresh();
          })
        }
      >
        {pending ? "Saving…" : `Mark ${total} paid`}
      </Button>
    </div>
  );
}
