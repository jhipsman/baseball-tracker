"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  activityKey,
  previewScheduleChange,
  scheduleConflicts,
  type Activity,
  type ScheduleChange,
} from "@/lib/team-schedule";
import { changeSchedule, loadEventSeries } from "@/lib/team-schedule-actions";
export function ActivityManager({
  activities: initialActivities,
  groups,
}: {
  activities: Activity[];
  groups: { id: string; name: string }[];
}) {
  const [seriesActivities, setSeriesActivities] = useState<Activity[]>([]);
  const activities = [
    ...initialActivities.filter(
      (a) => !seriesActivities.some((b) => activityKey(a) === activityKey(b)),
    ),
    ...seriesActivities,
  ];
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [group, setGroup] = useState("");
  const [view, setView] = useState("list");
  const [selected, setSelected] = useState<string[]>([]);
  const [action, setAction] = useState<ScheduleChange["action"]>("reschedule");
  const [days, setDays] = useState(0);
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [changeTime, setChangeTime] = useState(false);
  const [changeLocation, setChangeLocation] = useState(false);
  const [notify, setNotify] = useState(true);
  const [proposal, setProposal] = useState<ScheduleChange | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const chosen = activities.filter((a) => selected.includes(activityKey(a)));
  const visible = activities.filter(
    (a) =>
      (!kind || a.kind === kind) &&
      (!group || !a.group_id || a.group_id === group) &&
      `${a.title} ${a.location ?? ""} ${groups.find((g) => g.id === a.group_id)?.name ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const proposed = proposal ? previewScheduleChange(activities, proposal) : activities;
  const conflicts = useMemo(() => scheduleConflicts(proposed), [proposed]);
  const relevant = conflicts.filter(
    (c) => selected.includes(c.first) || selected.includes(c.second),
  );
  const cls = "h-11 max-w-full rounded-lg bg-surface px-3 text-sm ring-1 ring-zinc-300";
  function toggle(key: string) {
    setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));
    setProposal(null);
  }
  function draft(overrides: Partial<ScheduleChange> = {}) {
    setError("");
    setConfirmDelete(false);
    setProposal({
      items: chosen.map((a) => ({ id: a.id, kind: a.kind, updatedAt: a.updated_at })),
      action,
      days,
      time: changeTime ? time : null,
      location: changeLocation ? location : null,
      notify,
      ...overrides,
    });
  }
  function drop(event: React.DragEvent, date?: string, newLocation?: string) {
    event.preventDefault();
    const key = event.dataTransfer.getData("text/plain");
    const a = activities.find((a) => activityKey(a) === key);
    if (!a || pending) return;
    setSelected([key]);
    setConfirmDelete(false);
    setProposal({
      items: [{ id: a.id, kind: a.kind, updatedAt: a.updated_at }],
      action: "reschedule",
      days: date ? Math.round((Date.parse(date) - Date.parse(a.date)) / 86400000) : 0,
      time: null,
      location: newLocation ?? null,
      notify,
    });
  }
  function row(a: Activity) {
    return (
      <tr
        key={activityKey(a)}
        draggable={!pending}
        onDragStart={(e) => e.dataTransfer.setData("text/plain", activityKey(a))}
        className="border-t border-zinc-200"
      >
        <td className="p-3">
          <input
            type="checkbox"
            aria-label={`Select ${a.title} on ${a.date}`}
            checked={selected.includes(activityKey(a))}
            onChange={() => toggle(activityKey(a))}
            disabled={pending}
          />
        </td>
        <td className="p-3">
          <Link
            href={`/events/${a.kind}/${a.id}`}
            className="font-semibold text-brand-700 hover:underline"
          >
            {a.title}
          </Link>
          <span className="mt-1 block text-xs text-zinc-500">
            {a.kind} · {a.state}
            {a.series_id ? " · weekly series" : ""}
          </span>
        </td>
        <td className="p-3 whitespace-nowrap">
          {a.date}
          <span className="block text-xs text-zinc-500">
            {a.start_time?.slice(0, 5) ?? "Time not set"}
          </span>
        </td>
        <td className="p-3">{a.location ?? "Location not set"}</td>
        <td className="p-3">{groups.find((g) => g.id === a.group_id)?.name ?? "Whole team"}</td>
        <td className="p-3">
          <Link className="text-brand-700 underline" href={`/events/${a.kind}/${a.id}`}>
            RSVP / check-in
          </Link>
          {a.series_id && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  try {
                    const result = await loadEventSeries(a.series_id!);
                    if (result.error) {
                      setError(result.error);
                      return;
                    }
                    setSeriesActivities(result.activities ?? []);
                    setSelected((result.activities ?? []).map(activityKey));
                    setProposal(null);
                    setMessage(
                      "Entire series selected, including dates outside the current date range.",
                    );
                  } catch {
                    setError("The series could not be loaded. Try again.");
                  }
                })
              }
              className="mt-2 block text-xs text-brand-700 underline"
            >
              Select entire series
            </button>
          )}
        </td>
      </tr>
    );
  }
  function table(rows: Activity[]) {
    return (
      <div className="overflow-x-auto rounded-xl bg-surface ring-1 ring-zinc-200">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="p-3">
                <input
                  aria-label="Select visible activities"
                  type="checkbox"
                  checked={!!rows.length && rows.every((a) => selected.includes(activityKey(a)))}
                  onChange={(e) => {
                    setSelected(
                      e.target.checked
                        ? [...new Set([...selected, ...rows.map(activityKey)])]
                        : selected.filter((k) => !rows.some((a) => activityKey(a) === k)),
                    );
                    setProposal(null);
                  }}
                />
              </th>
              {["Activity", "When", "Location", "Group", "Attendance"].map((h) => (
                <th key={h} className="p-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{rows.map(row)}</tbody>
        </table>
      </div>
    );
  }
  const buckets = [
    ...new Set(
      visible.map((a) => (view === "location" ? (a.location ?? "Location not set") : a.date)),
    ),
  ].sort();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          Search
          <input
            className={`${cls} block`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Activity, team, or field"
          />
        </label>
        <label className="space-y-1 text-sm">
          Type
          <select className={`${cls} block`} value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">All types</option>
            {["game", "practice", "event"].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          Group
          <select
            className={`${cls} block`}
            value={group}
            onChange={(e) => setGroup(e.target.value)}
          >
            <option value="">All groups</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          View
          <select className={`${cls} block`} value={view} onChange={(e) => setView(e.target.value)}>
            <option value="list">List</option>
            <option value="day">By day</option>
            <option value="location">By location</option>
          </select>
        </label>
      </div>
      <p className="text-sm text-zinc-600" role="status">
        {visible.length} activities · {selected.length} selected
        {selected.length > 100 ? " · select no more than 100 at a time" : ""}
      </p>
      {selected.length > 0 && (
        <section className="space-y-4 rounded-xl bg-surface p-5 ring-1 ring-zinc-200">
          <h2 className="font-semibold">Change selected activities</h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-sm">
              Action
              <select
                className={`${cls} block`}
                value={action}
                onChange={(e) => {
                  setAction(e.target.value as ScheduleChange["action"]);
                  setProposal(null);
                }}
              >
                {["reschedule", "cancel", "restore", "delete"].map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            {action === "reschedule" && (
              <>
                <label className="space-y-1 text-sm">
                  Move by days
                  <input
                    className={`${cls} block w-32`}
                    type="number"
                    value={days}
                    min={-365}
                    max={365}
                    onChange={(e) => {
                      setDays(Number(e.target.value));
                      setProposal(null);
                    }}
                  />
                </label>
                <label className="text-sm">
                  <span className="flex min-h-11 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={changeTime}
                      onChange={(e) => {
                        setChangeTime(e.target.checked);
                        setProposal(null);
                      }}
                    />
                    Change start time
                  </span>
                  <input
                    type="time"
                    aria-label="New start time"
                    disabled={!changeTime}
                    value={time}
                    onChange={(e) => {
                      setTime(e.target.value);
                      setProposal(null);
                    }}
                    className={cls}
                  />
                </label>
                <label className="text-sm">
                  <span className="flex min-h-11 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={changeLocation}
                      onChange={(e) => {
                        setChangeLocation(e.target.checked);
                        setProposal(null);
                      }}
                    />
                    Change location
                  </span>
                  <input
                    aria-label="New location"
                    disabled={!changeLocation}
                    maxLength={200}
                    value={location}
                    onChange={(e) => {
                      setLocation(e.target.value);
                      setProposal(null);
                    }}
                    className={cls}
                  />
                </label>
              </>
            )}
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => {
                setNotify(e.target.checked);
                setProposal(null);
              }}
            />
            Notify affected team members after saving
          </label>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              disabled={pending || selected.length > 100}
              onClick={() => draft()}
            >
              Review changes
            </Button>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setSelected([]);
                setProposal(null);
              }}
            >
              Clear selection
            </Button>
          </div>
        </section>
      )}
      {proposal && (
        <section
          aria-label="Schedule change preview"
          className="space-y-4 rounded-xl bg-surface p-5 ring-1 ring-brand-500"
        >
          <h2 className="font-semibold">
            Confirm {proposal.action}: {proposal.items.length} activities
          </h2>
          <ul className="max-h-60 space-y-2 overflow-auto text-sm">
            {activities
              .filter((a) => proposal.items.some((r) => activityKey(r) === activityKey(a)))
              .map((a) => {
                const after = previewScheduleChange([a], proposal)[0];
                return (
                  <li key={activityKey(a)}>
                    <strong>{a.title}</strong> · {a.date} {a.start_time?.slice(0, 5)} →{" "}
                    {proposal.action === "delete"
                      ? "Permanently deleted"
                      : proposal.action === "cancel"
                        ? "Canceled"
                        : proposal.action === "restore"
                          ? "Scheduled"
                          : `${after.date} ${after.start_time?.slice(0, 5) ?? "time not set"} · ${after.location ?? "location not set"}`}
                  </li>
                );
              })}
          </ul>
          <p className="text-sm text-zinc-600">
            {proposal.notify
              ? "Affected team members will be notified."
              : "No notifications will be sent."}
          </p>
          {relevant.length > 0 && proposal.action === "reschedule" && (
            <p role="alert" className="text-sm text-amber-800">
              ⚠ {relevant.length} possible location conflicts. Games use a two-hour scheduled
              duration for this check. Review shared field use before confirming.
            </p>
          )}
          {proposal.action === "delete" && (
            <label className="flex min-h-11 items-center gap-2 text-sm text-red-800">
              <input
                type="checkbox"
                checked={confirmDelete}
                onChange={(e) => setConfirmDelete(e.target.checked)}
              />
              I understand these activities and their attendance records will be permanently
              deleted.
            </label>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={pending || (proposal.action === "delete" && !confirmDelete)}
              onClick={() =>
                start(async () => {
                  setError("");
                  try {
                    const result = await changeSchedule(proposal);
                    if (result.error) setError(result.error);
                    else {
                      setMessage(`${result.changed} activities updated.`);
                      setSeriesActivities([]);
                      setSelected([]);
                      setProposal(null);
                    }
                  } catch {
                    setError("The changes did not finish. Refresh the schedule before retrying.");
                  }
                })
              }
            >
              {pending ? "Saving…" : "Confirm changes"}
            </Button>
            <Button variant="ghost" disabled={pending} onClick={() => setProposal(null)}>
              Keep reviewing
            </Button>
          </div>
        </section>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-800">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-brand-700">
          {message}
        </p>
      )}
      {view === "list"
        ? table(visible)
        : buckets.map((bucket) => (
            <section
              key={bucket}
              className="space-y-3 rounded-xl p-1"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) =>
                drop(
                  e,
                  view === "day" ? bucket : undefined,
                  view === "location" && bucket !== "Location not set" ? bucket : undefined,
                )
              }
            >
              <h2 className="font-semibold">{bucket}</h2>
              {table(
                visible.filter(
                  (a) =>
                    (view === "location" ? (a.location ?? "Location not set") : a.date) === bucket,
                ),
              )}
            </section>
          ))}
      {!visible.length && (
        <p className="rounded-xl bg-surface p-6 text-sm text-zinc-600 ring-1 ring-zinc-200">
          No activities match these filters. Change the dates or create a team event.
        </p>
      )}
      {view !== "list" && (
        <p className="text-xs text-zinc-500">
          Drag an activity to another {view === "day" ? "day" : "location"} to preview a move, or
          use the selection controls above.
        </p>
      )}
    </div>
  );
}
