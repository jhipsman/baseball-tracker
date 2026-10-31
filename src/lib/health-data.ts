import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { formatGameDate } from "./games";
import {
  playerHealth,
  STATUS_COLUMNS,
  toHealthStatus,
  type HealthStatus,
  type PlayerHealth,
} from "./health";
import { addDays } from "./schedule";
import { loadBirthDates, loadThrowing, type ThrowingRow } from "./throwing";
import { availability, throwingAlerts } from "./workload";
import { bodyAlerts, type BodyCheckin, type Sleep } from "./body";

type Client = SupabaseClient<Database>;

/** Coach-set statuses for the org (players without one are fully available). */
export async function loadHealthStatuses(supabase: Client, orgId: string) {
  const { data } = await supabase
    .from("player_health_status")
    .select(`player_id, ${STATUS_COLUMNS}`)
    .eq("org_id", orgId);
  return new Map<string, HealthStatus>((data ?? []).map((r) => [r.player_id, toHealthStatus(r)]));
}

/** Alert keys a coach has marked handled, per player. */
export async function loadAcks(supabase: Client, orgId: string) {
  const { data } = await supabase
    .from("health_alert_acks")
    .select("player_id, alert_key, note, acked_at")
    .eq("org_id", orgId)
    .gte("acked_at", `${addDays(new Date().toISOString().slice(0, 10), -60)}T00:00:00Z`);
  const byPlayer = new Map<string, Set<string>>();
  for (const r of data ?? []) {
    if (!byPlayer.has(r.player_id)) byPlayer.set(r.player_id, new Set());
    byPlayer.get(r.player_id)!.add(r.alert_key);
  }
  return byPlayer;
}

/** Health for each player on `day` (the Today board, the pitcher picker, player pages). */
export async function loadHealth(
  supabase: Client,
  orgId: string,
  players: { id: string; name: string }[],
  day: string,
): Promise<{
  health: PlayerHealth[];
  rows: ThrowingRow[];
  births: Map<string, string | null>;
  body: Map<string, BodyCheckin[]>;
}> {
  const [rows, births, statuses, acks, body] = await Promise.all([
    loadThrowing(supabase, orgId, addDays(day, -60)),
    loadBirthDates(supabase, orgId),
    loadHealthStatuses(supabase, orgId),
    loadAcks(supabase, orgId),
    loadBodyCheckins(supabase, orgId, addDays(day, -21), day),
  ]);
  const health = players.map((p) => {
    const mine = rows.filter((r) => r.playerId === p.id && r.date <= day);
    const birth = births.get(p.id) ?? null;
    const recentFeel = mine.find((r) => r.armFeel && r.date >= addDays(day, -6));
    return playerHealth({
      id: p.id,
      name: p.name,
      status: statuses.get(p.id) ?? null,
      alerts: [...throwingAlerts(mine, birth, day), ...bodyAlerts(body.get(p.id) ?? [], day)],
      body: (body.get(p.id) ?? []).find((c) => c.date >= addDays(day, -6)) ?? null,
      acked: acks.get(p.id) ?? new Set(),
      avail: availability(mine, birth, day),
      feel: recentFeel?.armFeel ? { feel: recentFeel.armFeel, date: recentFeel.date } : null,
      checkedInToday: mine.some((r) => r.date === day && r.armFeel),
      dateLabel: (d) => formatGameDate(d),
    });
  });
  return { health, rows, births, body };
}

/** Past injuries for one player, newest first. */
export async function loadHealthHistory(supabase: Client, orgId: string, playerId: string) {
  const { data } = await supabase
    .from("player_health_history")
    .select(
      "id, status, injury_type, body_part, side, reason, started_on, ended_on, clearance_path",
    )
    .eq("org_id", orgId)
    .eq("player_id", playerId)
    .order("ended_on", { ascending: false })
    .limit(30);
  return data ?? [];
}

/** Body check-ins per player between two days, newest first. */
export async function loadBodyCheckins(
  supabase: Client,
  orgId: string,
  from: string,
  to: string,
  playerId?: string,
) {
  let q = supabase
    .from("body_checkins")
    .select("player_id, date, feel, sore, sleep, note")
    .eq("org_id", orgId)
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: false });
  if (playerId) q = q.eq("player_id", playerId);
  const { data } = await q;
  const byPlayer = new Map<string, BodyCheckin[]>();
  for (const r of data ?? []) {
    if (!byPlayer.has(r.player_id)) byPlayer.set(r.player_id, []);
    byPlayer.get(r.player_id)!.push({
      date: r.date,
      feel: r.feel,
      sore: r.sore ?? [],
      sleep: (r.sleep as Sleep | null) ?? null,
      note: r.note,
    });
  }
  return byPlayer;
}
