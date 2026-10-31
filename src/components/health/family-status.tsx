import { injuryLabel, planTitle, type HealthStatus } from "@/lib/health";
import { cn } from "@/lib/utils";
import { ClearanceUpload } from "./clearance";

const day = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

/**
 * The coach's call as the player or a parent sees it: out / limited, the
 * injury, the return plan's progress and (for a concussion) the clearance the
 * team needs, with an upload.
 */
export function FamilyHealthStatus({
  status,
  orgId,
  playerId,
  firstName,
  self,
}: {
  status: HealthStatus;
  orgId: string;
  playerId: string;
  firstName: string;
  /** The player is looking (else a parent). */
  self: boolean;
}) {
  if (status.status === "full") return null;
  const out = status.status === "out";
  const concussion = status.injury.type === "concussion";
  const what = injuryLabel(status.injury);
  const plan = status.plan;
  const next = plan.find((p) => !p.done);
  const who = self ? "you" : firstName;
  return (
    <section
      id="health"
      aria-label={self ? "Your status" : `${firstName}'s status`}
      className={cn(
        "scroll-mt-24 space-y-2 rounded-2xl p-4 ring-1",
        out
          ? "bg-red-50 text-red-900 ring-red-200"
          : "bg-orange-50 text-orange-950 ring-orange-300",
      )}
    >
      <p className="font-semibold">
        {out ? `⛔ Coach has ${who} out` : `◐ Coach has ${who} limited`}
        {what ? `: ${what}` : ""}
      </p>
      {status.reason ? <p className="text-sm">{status.reason}</p> : null}
      {status.returnDate ? <p className="text-sm">Expected back {day(status.returnDate)}</p> : null}
      {concussion ? (
        <p className="text-sm">
          {self ? "No" : `${firstName} can't`} practice or play until symptom-free and a doctor
          gives written clearance. Each step takes at least a day without symptoms; if symptoms come
          back, tell the coach and go back a step.
        </p>
      ) : null}
      {plan.length ? (
        <div className="text-sm">
          <p className="font-medium">
            {planTitle(status.injury)}: {plan.filter((p) => p.done).length} of {plan.length} steps
          </p>
          {next ? <p>Next: {next.label}</p> : null}
        </div>
      ) : null}
      <div className="rounded-xl bg-surface p-3 text-zinc-900 ring-1 ring-zinc-200">
        <ClearanceUpload
          orgId={orgId}
          playerId={playerId}
          path={status.injury.clearancePath}
          uploadedAt={status.injury.clearanceAt}
          concussion={concussion}
          audience="family"
        />
      </div>
    </section>
  );
}
