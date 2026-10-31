import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { playerToday } from "@/lib/player";
import { loadTeam } from "@/lib/team";
import { addDays } from "@/lib/schedule";
import { growthRate, SPURT_IN_PER_YEAR } from "@/lib/load";
import { GrowthForm, type GrowthRow } from "@/components/health/growth-form";

export const metadata: Metadata = { title: "Growth" };

/** Monthly heights for the team, with growth spurts flagged. */
export default async function GrowthPage() {
  const { supabase, org, isStaff } = await requireActiveOrg();
  if (!isStaff) redirect("/");
  const { today } = await playerToday();
  const [team, { data: heights }] = await Promise.all([
    loadTeam(supabase, org.id, today, today, today),
    supabase
      .from("growth_measurements")
      .select("player_id, measured_on, height_in")
      .eq("org_id", org.id)
      .gte("measured_on", addDays(today, -400))
      .order("measured_on", { ascending: false }),
  ]);
  const rows: GrowthRow[] = team.players.map((p) => {
    const mine = (heights ?? [])
      .filter((h) => h.player_id === p.id)
      .map((h) => ({ date: h.measured_on, inches: Number(h.height_in) }));
    const g = growthRate(mine);
    const last = mine[0] ?? null;
    return {
      id: p.id,
      name: p.name,
      last,
      perYear: g?.perYear ?? null,
      due: !last || last.date < addDays(today, -30),
      spurt: !!g && g.perYear >= SPURT_IN_PER_YEAR,
    };
  });
  const spurts = rows.filter((r) => r.spurt).length;
  const due = rows.filter((r) => r.due).length;
  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">Growth</h1>
        <p className="text-sm text-zinc-600">
          Measure once a month (shoes off). Players growing about {SPURT_IN_PER_YEAR}+ inches a year
          are in a growth spurt, when bones outpace muscles and injury risk goes up: go easier on
          throwing and lifting volume.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        {spurts ? (
          <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-950">
            {spurts} in a growth spurt
          </span>
        ) : null}
        <span className="rounded-full bg-zinc-100 px-3 py-1 font-medium text-zinc-700">
          {due} due for a measurement
        </span>
      </div>
      {rows.length ? (
        <GrowthForm rows={rows} today={today} />
      ) : (
        <p className="rounded-2xl bg-surface p-6 text-sm text-zinc-600 ring-1 ring-zinc-200">
          No players on the roster yet.
        </p>
      )}
    </div>
  );
}
