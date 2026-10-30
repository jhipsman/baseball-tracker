import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { STARTER_PRACTICES } from "@/lib/starter-practices";
import { insertStarterTemplates } from "@/lib/starter-seed";
import { addDays, planDates } from "@/lib/schedule";
import { toBlocksPayload } from "@/lib/practices";

type Client = SupabaseClient<Database>;
type J = NonNullable<Json>;
type Pos = Database["public"]["Enums"]["player_position"];

/**
 * The sample roster. Names are invented. Ages 13–16 so the demo never needs
 * under-13 parental consent. `story` marks the players the demo is built around.
 */
const PLAYERS: { key: string; name: string; pos: Pos; jersey: number; age: number }[] = [
  { key: "noah", name: "Noah Patel", pos: "P", jersey: 21, age: 15 }, // reported elbow pain
  { key: "mateo", name: "Mateo Alvarez", pos: "P", jersey: 12, age: 14 }, // pitched yesterday → rest
  { key: "owen", name: "Owen Walsh", pos: "P", jersey: 18, age: 15 }, // fresh, available
  { key: "ethan", name: "Ethan Brooks", pos: "C", jersey: 7, age: 16 },
  { key: "aiden", name: "Aiden Murphy", pos: "1B", jersey: 33, age: 15 },
  { key: "logan", name: "Logan Price", pos: "2B", jersey: 4, age: 14 },
  { key: "lucas", name: "Lucas Chen", pos: "SS", jersey: 3, age: 15 },
  { key: "carter", name: "Carter Hayes", pos: "3B", jersey: 15, age: 16 },
  { key: "diego", name: "Diego Santos", pos: "OF", jersey: 9, age: 14 },
  { key: "jackson", name: "Jackson Reed", pos: "OF", jersey: 24, age: 15 },
  { key: "mason", name: "Mason Rivera", pos: "OF", jersey: 2, age: 14 },
  { key: "ryan", name: "Ryan Kim", pos: "UTIL", jersey: 10, age: 14 },
];
const PARENTS = [
  { key: "priya", name: "Priya Patel", of: "noah" },
  { key: "sofia", name: "Sofia Alvarez", of: "mateo" },
  { key: "mike", name: "Mike Walsh", of: "owen" },
];
/** Players who skip some workouts (so "needs attention" has someone in it). */
const SLACKERS = new Set(["logan", "diego"]);
const LINEUP = ["lucas", "jackson", "carter", "aiden", "ethan", "logan", "diego", "mason", "ryan"];

export const DEMO_TEAM_NAME = "Demo · Riverside Rays";

function birthDate(today: string, age: number, i: number) {
  const [y, m, d] = today.split("-").map(Number);
  // Born age years ago, a few months before today, staggered per player.
  const date = new Date(Date.UTC(y - age, m - 1, d) - (40 + i * 17) * 86_400_000);
  return date.toISOString().slice(0, 10);
}

/** Small deterministic "random" so the demo looks the same every time. */
function pick(seed: number, n: number) {
  return Math.abs(Math.sin(seed * 9301 + 49297)) * n;
}

/** Creates the caller's demo team (once) and fills it with a few weeks of activity. */
export async function createDemoTeam(supabase: Client, userId: string, today: string) {
  const people = [
    ...PLAYERS.map((p, i) => ({
      key: p.key,
      name: p.name,
      role: "player",
      birth_date: birthDate(today, p.age, i),
      position: p.pos,
      jersey: p.jersey,
      group: p.pos === "P" || p.pos === "C" ? "Pitchers & catchers" : "",
    })),
    ...PARENTS.map((p) => ({ key: p.key, name: p.name, role: "parent", parent_of: p.of })),
  ];
  const { data, error } = await supabase.rpc("create_demo_team", {
    p_name: DEMO_TEAM_NAME,
    p_people: people as J,
  });
  if (error) throw new Error(error.message);
  const result = data as {
    org: string;
    created: boolean;
    people?: Record<string, string>;
    groups?: Record<string, string>;
  };
  if (!result.created || !result.people) return result.org;
  try {
    await fillDemoTeam(supabase, userId, result.org, result.people, result.groups ?? {}, today);
  } catch (e) {
    // Never leave a half-built demo behind: the next try starts clean.
    await supabase.rpc("delete_demo_team", { p_org: result.org });
    throw e;
  }
  return result.org;
}

async function fillDemoTeam(
  supabase: Client,
  userId: string,
  orgId: string,
  id: Record<string, string>,
  groups: Record<string, string>,
  today: string,
) {
  const must = <T>(r: { data: T; error: { message: string } | null }) => {
    if (r.error) throw new Error(r.error.message);
    return r.data as NonNullable<T>;
  };
  const pitchersGroup = groups["Pitchers & catchers"] ?? null;

  // --- Programs: long toss for position players, bullpen progression for pitchers --
  const templates = await insertStarterTemplates(supabase, orgId, userId);
  const start = addDays(today, -15);
  const plans: { programId: string; players: string[] }[] = [];
  for (const [name, players] of [
    ["Long Toss Build-up (6 weeks)", PLAYERS.filter((p) => p.pos !== "P").map((p) => p.key)],
    ["Bullpen Progression (4 weeks)", ["noah", "mateo", "owen"]],
  ] as const) {
    const templateId = templates.get(name);
    if (!templateId) continue;
    const programId = must(
      await supabase.rpc("duplicate_program", {
        p_program_id: templateId,
        p_name: name.replace(/ \(.*\)$/, ""),
        p_is_template: false,
      }),
    ) as string;
    plans.push({ programId, players: [...players] });
  }

  const workouts: Record<string, unknown>[] = [];
  for (const plan of plans) {
    const weeks = must(
      await supabase
        .from("program_weeks")
        .select("week_number, program_days (id, name, day_of_week, sort_order)")
        .eq("program_id", plan.programId)
        .order("week_number"),
    );
    const schedule = weeks.map((w) => ({
      days: w.program_days
        .toSorted((a, b) => a.sort_order - b.sort_order)
        .map((d) => ({ id: d.id, dayOfWeek: d.day_of_week, name: d.name })),
    }));
    const names = new Map(schedule.flatMap((w) => w.days.map((d) => [d.id, d.name])));
    const assignments = must(
      await supabase
        .from("program_assignments")
        .insert(
          plan.players.map((k) => ({
            program_id: plan.programId,
            player_id: id[k],
            assigned_by: userId,
            start_date: start,
          })),
        )
        .select("id, player_id"),
    );
    for (const a of assignments) {
      const key = Object.keys(id).find((k) => id[k] === a.player_id)!;
      planDates(start, schedule).forEach(({ dayId, date }, i) => {
        if (date >= today) return;
        const r = pick(i * 31 + [...key].reduce((n, c) => n + c.charCodeAt(0), 0), 1);
        // Slackers have missed this week; everyone else misses the odd day.
        if (SLACKERS.has(key) ? date >= addDays(today, -7) || r < 0.4 : r < 0.12) return;
        workouts.push({
          assignment_id: a.id,
          day_id: dayId,
          player_id: a.player_id,
          date,
          status: r > 0.92 ? "partial" : "completed",
          minutes: 20 + Math.round(pick(i, 25)),
          rpe: 4 + Math.round(pick(i + 3, 3)),
          day_name: names.get(dayId) ?? "Workout",
          // Logged that evening, so "recent workouts" reads in date order.
          logged_at: `${date}T${17 + (i % 4)}:${String((key.length * 7) % 60).padStart(2, "0")}:00Z`,
        });
      });
    }
  }

  // --- Games: three finals (pitch counts flow into throwing logs), four upcoming ---
  const tournament = must(
    await supabase
      .from("tournaments")
      .insert({
        org_id: orgId,
        name: "Fall Classic",
        start_date: addDays(today, 8),
        end_date: addDays(today, 9),
        location: "Northside Sports Complex",
        created_by: userId,
      })
      .select("id")
      .single(),
  );
  const line = (us: number[], them: number[]) => us.map((u, i) => ({ us: u, them: them[i] }));
  const finals = [
    {
      daysAgo: 12,
      opp: "Cedar Creek Bulldogs",
      ha: "home",
      l: line([2, 0, 1, 0, 3, 1, 0], [0, 1, 0, 0, 2, 0, 0]),
      starter: "owen",
      pitches: 72,
      relief: "noah",
    },
    {
      daysAgo: 5,
      opp: "North County Mustangs",
      ha: "away",
      l: line([0, 1, 0, 0, 1, 0, 0], [1, 0, 0, 2, 0, 1, 0]),
      starter: "noah",
      pitches: 64,
      relief: "owen",
    },
    {
      daysAgo: 1,
      opp: "Valley Storm",
      ha: "home",
      l: line([1, 0, 2, 0, 0, 2, 0], [0, 0, 1, 0, 1, 0, 1]),
      starter: "mateo",
      pitches: 78,
      relief: "owen",
    },
  ] as const;
  for (const [gi, f] of finals.entries()) {
    const us = f.l.reduce((s, i) => s + i.us, 0);
    const them = f.l.reduce((s, i) => s + i.them, 0);
    const game = must(
      await supabase
        .from("games")
        .insert({
          org_id: orgId,
          opponent: f.opp,
          kind: "league",
          home_away: f.ha,
          date: addDays(today, -f.daysAgo),
          start_time: "10:00",
          location:
            f.ha === "home" ? "Riverside Park Field 1" : `${f.opp.split(" ")[0]} High School`,
          status: "final",
          team_score: us,
          opponent_score: them,
          line_score: f.l as J,
          innings_scheduled: 7,
          created_by: userId,
        })
        .select("id")
        .single(),
    );
    const batting = LINEUP.map((k, i) => {
      const ab = 3 + Math.round(pick(gi * 10 + i, 1));
      const h = Math.min(ab, Math.round(pick(gi * 13 + i, 2.4)));
      return {
        player_id: id[k],
        batting_order: i + 1,
        position:
          PLAYERS.find((p) => p.key === k)!.pos === "UTIL"
            ? "DH"
            : PLAYERS.find((p) => p.key === k)!.pos,
        ab,
        h,
        r: Math.min(h, Math.round(pick(gi * 17 + i, 1.4))),
        rbi: Math.round(pick(gi * 19 + i, 1.6)),
        doubles: h > 1 ? 1 : 0,
        bb: Math.round(pick(gi * 23 + i, 1.2)),
        so: Math.round(pick(gi * 29 + i, 1.8)),
      };
    });
    const pitching = [
      {
        player_id: id[f.starter],
        sort_order: 1,
        outs: 15,
        h: 4,
        r: 2,
        er: 2,
        bb: 2,
        so: 6,
        pitches: f.pitches,
        strikes: Math.round(f.pitches * 0.62),
        decision: us > them ? "W" : "L",
      },
      {
        player_id: id[f.relief],
        sort_order: 2,
        outs: 6,
        h: 1,
        r: them > 3 ? 1 : 0,
        er: 0,
        bb: 0,
        so: 2,
        pitches: 24,
        strikes: 16,
        decision: "",
      },
    ];
    must(
      await supabase.rpc("save_box_score", {
        p_game_id: game.id,
        p_batting: batting as J,
        p_pitching: pitching as J,
      }),
    );
  }
  const upcoming = must(
    await supabase
      .from("games")
      .insert([
        {
          org_id: orgId,
          opponent: "Lakeside Hawks",
          kind: "league",
          home_away: "home",
          date: addDays(today, 1),
          start_time: "10:00",
          arrival_time: "09:00",
          location: "Riverside Park Field 1",
          status: "scheduled",
          innings_scheduled: 7,
          created_by: userId,
        },
        {
          org_id: orgId,
          opponent: "Cedar Creek Bulldogs",
          kind: "league",
          home_away: "away",
          date: addDays(today, 4),
          start_time: "17:30",
          arrival_time: "16:45",
          location: "Cedar Creek High School",
          status: "scheduled",
          innings_scheduled: 7,
          created_by: userId,
        },
        {
          org_id: orgId,
          opponent: "Metro Mavericks",
          kind: "tournament",
          tournament_id: tournament.id,
          home_away: "neutral",
          date: addDays(today, 8),
          start_time: "09:00",
          arrival_time: "08:00",
          location: "Northside Sports Complex Field 3",
          status: "scheduled",
          innings_scheduled: 7,
          created_by: userId,
        },
        {
          org_id: orgId,
          opponent: "Bayview Pirates",
          kind: "tournament",
          tournament_id: tournament.id,
          home_away: "neutral",
          date: addDays(today, 9),
          start_time: "12:30",
          arrival_time: "11:45",
          location: "Northside Sports Complex Field 1",
          status: "scheduled",
          innings_scheduled: 7,
          created_by: userId,
        },
      ])
      .select("id, date")
      .order("date"),
  );

  // --- Practices and a team event ---------------------------------------------------
  const practiceIds: string[] = [];
  for (const [i, p] of [
    { t: STARTER_PRACTICES[0], date: addDays(today, 2), group: null },
    {
      t: STARTER_PRACTICES[2] ?? STARTER_PRACTICES[0],
      date: addDays(today, 3),
      group: pitchersGroup,
    },
  ].entries()) {
    const plan = must(
      await supabase
        .from("practice_plans")
        .insert({
          org_id: orgId,
          group_id: p.group,
          title: p.t.title,
          notes: p.t.notes,
          date: p.date,
          start_time: i === 0 ? "17:30" : "16:00",
          location: "Riverside Park Field 1",
          published: true,
          created_by: userId,
        })
        .select("id")
        .single(),
    );
    const blocks = toBlocksPayload(
      p.t.blocks.map((b) => ({ ...b, details: b.details ?? "", stations: b.stations ?? [] })),
    );
    if ("payload" in blocks && blocks.payload.length) {
      must(
        await supabase.rpc("save_practice_blocks", {
          p_plan_id: plan.id,
          p_blocks: blocks.payload as J,
        }),
      );
    }
    practiceIds.push(plan.id);
  }
  must(
    await supabase.rpc("create_team_events", {
      p_org: orgId,
      p_event: {
        title: "Team photos",
        event_type: "social",
        date: addDays(today, 6),
        start_time: "18:00",
        duration_minutes: 45,
        location: "Riverside Park pavilion",
        notes: "Full uniform, hats on.",
      },
      p_count: 1,
      p_notify: false,
    }),
  );

  // --- Player-side activity: workouts, arm check-ins, RSVPs -------------------------
  const throws = [
    {
      player_id: id.noah,
      date: addDays(today, -1),
      type: "check_in",
      arm_feel: "pain",
      notes: "Inside of my elbow hurts after long toss.",
    },
    {
      player_id: id.noah,
      date: addDays(today, -3),
      type: "long_toss",
      distance: 150,
      intensity: "moderate",
      arm_feel: "sore",
    },
    {
      player_id: id.owen,
      date: addDays(today, -3),
      type: "bullpen",
      pitches: 30,
      intensity: "moderate",
      arm_feel: "great",
    },
    {
      player_id: id.owen,
      date: addDays(today, -8),
      type: "long_toss",
      distance: 210,
      intensity: "high",
      arm_feel: "good",
    },
    {
      player_id: id.mateo,
      date: addDays(today, -4),
      type: "bullpen",
      pitches: 25,
      intensity: "moderate",
      arm_feel: "good",
    },
    { player_id: id.mateo, date: today, type: "check_in", arm_feel: "tired" },
    {
      player_id: id.ethan,
      date: addDays(today, -2),
      type: "long_toss",
      distance: 180,
      intensity: "moderate",
      arm_feel: "good",
    },
    {
      player_id: id.lucas,
      date: addDays(today, -2),
      type: "flat_ground",
      pitches: 40,
      intensity: "low",
      arm_feel: "great",
    },
  ];
  const nextGame = upcoming[0];
  const attendance = [
    ...PLAYERS.filter((p) => p.key !== "noah" && p.key !== "ryan").map((p) => ({
      kind: "game",
      activity_id: nextGame.id,
      player_id: id[p.key],
      response: p.key === "diego" ? "maybe" : "yes",
    })),
    { kind: "game", activity_id: nextGame.id, player_id: id.noah, response: "no" },
    ...PLAYERS.slice(0, 6).map((p) => ({
      kind: "practice",
      activity_id: practiceIds[0],
      player_id: id[p.key],
      response: "yes",
    })),
  ];
  must(
    await supabase.rpc("seed_demo_activity", {
      p_org: orgId,
      p_rows: { workouts, throws, attendance } as J,
    }),
  );

  // --- Testing numbers (two test days, so progress shows) ---------------------------
  must(
    await supabase.from("assessments").insert(
      PLAYERS.flatMap((p, i) =>
        [
          { date: addDays(today, -42), bump: 0 },
          { date: addDays(today, -10), bump: 1 },
        ].map(({ date, bump }) => ({
          org_id: orgId,
          player_id: id[p.key],
          assessed_by: userId,
          assessment_date: date,
          data: {
            exit_velo: Math.round(68 + p.age + pick(i, 6) + bump * 2.5),
            sixty_time: Number((7.9 - p.age * 0.06 - pick(i + 2, 0.3) - bump * 0.08).toFixed(2)),
            ...(p.pos === "P"
              ? { fastball_velo: Math.round(64 + p.age + pick(i + 4, 4) + bump * 2) }
              : {}),
            ...(p.pos === "C" ? { pop_time: Number((2.35 - bump * 0.05).toFixed(2)) } : {}),
          } as J,
        })),
      ),
    ),
  );

  // --- Dues: one family paying on time, one overdue ---------------------------------
  for (const [i, d] of [
    { payer: id.priya, player: id.noah, first: addDays(today, -40), paid: 2 },
    { payer: id.sofia, player: id.mateo, first: addDays(today, -40), paid: 0 },
    { payer: id.mike, player: id.owen, first: addDays(today, -10), paid: 1 },
  ].entries()) {
    const planId = must(
      await supabase.rpc("create_team_payment_plan", {
        p_org: orgId,
        p_payer: d.payer,
        p_player: d.player,
        p_title: "Fall travel dues",
        p_season: "Fall 2026",
        p_cents: 15000,
        p_count: 4,
        p_first: d.first,
        p_request: `demo-${orgId}-${i}`,
      }),
    ) as string;
    const invoices = must(
      await supabase
        .from("team_invoices")
        .select("id")
        .eq("plan_id", planId)
        .order("installment_number")
        .limit(d.paid),
    );
    for (const [n, inv] of invoices.entries()) {
      must(
        await supabase.rpc("record_team_payment", {
          p_org: orgId,
          p_invoice: inv.id,
          p_kind: "payment",
          p_cents: 15000,
          p_method: n === 0 ? "check" : "cash",
          p_reference: n === 0 ? "Check #1042" : "",
          p_note: "",
          p_request: `demo-${orgId}-${i}-${n}`,
        }),
      );
    }
  }

  // --- Messages ----------------------------------------------------------------------
  must(
    await supabase.from("announcements").insert({
      org_id: orgId,
      author_id: userId,
      title: "Fall Classic next weekend",
      body: "Two games Saturday and Sunday at Northside Sports Complex. Arrive an hour early, full uniform. Pitchers: no long toss Friday.",
      include_parents: true,
      pinned: true,
    }),
  );
  await supabase.rpc("start_thread", {
    p_org_id: orgId,
    p_member_ids: [id.priya],
    p_subject: "Noah's elbow",
    p_body:
      "Hi Priya, Noah said his elbow hurt after long toss. He's off throwing this week and I'd like a trainer to take a look before he pitches again.",
  });
}

/** Deletes the caller's demo team and its sample people. */
export async function deleteDemoTeam(supabase: Client, orgId: string) {
  const { error } = await supabase.rpc("delete_demo_team", { p_org: orgId });
  if (error) throw new Error(error.message);
}
