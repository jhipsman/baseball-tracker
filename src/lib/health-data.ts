import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { formatGameDate } from "./games";
import { parsePlan, playerHealth, type HealthStatus, type PlayerHealth } from "./health";
import { addDays } from "./schedule";
import { loadBirthDates, loadThrowing, type ThrowingRow } from "./throwing";
import { availability, throwingAlerts } from "./workload";

type Client = SupabaseClient<Database>;

/** Coach-set statuses for the org (players without one are fully available). */
export async function loadHealthStatuses(supabase: Client, orgId: string) {
  const { data } = await supabase
    .from("player_health_status")
    .select("player_id, status, reason, return_date, plan")
    .eq("org_id", orgId);
  return new Map<string, HealthStatus>(
    (data ?? []).map((r) => [
      r.player_id,
      { status: r.status, reason: r.reason, returnDate: r.return_date, plan: parsePlan(r.plan) },
    ]),
  );
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
): Promise<{ health: PlayerHealth[]; rows: ThrowingRow[]; births: Map<string, string | null> }> {
  const [rows, births, statuses, acks] = await Promise.all([
    loadThrowing(supabase, orgId, addDays(day, -60)),
    loadBirthDates(supabase, orgId),
    loadHealthStatuses(supabase, orgId),
    loadAcks(supabase, orgId),
  ]);
  const health = players.map((p) => {
    const mine = rows.filter((r) => r.playerId === p.id && r.date <= day);
    const birth = births.get(p.id) ?? null;
    const recentFeel = mine.find((r) => r.armFeel && r.date >= addDays(day, -6));
    return playerHealth({
      id: p.id,
      name: p.name,
      status: statuses.get(p.id) ?? null,
      alerts: throwingAlerts(mine, birth, day),
      acked: acks.get(p.id) ?? new Set(),
      avail: availability(mine, birth, day),
      feel: recentFeel?.armFeel ? { feel: recentFeel.armFeel, date: recentFeel.date } : null,
      checkedInToday: mine.some((r) => r.date === day && r.armFeel),
      dateLabel: (d) => formatGameDate(d),
    });
  });
  return { health, rows, births };
}
