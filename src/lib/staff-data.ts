import "server-only";

import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { hasModule } from "@/constants/modules";
import { periodTotals, type Rate } from "@/lib/staff-pay";

export type StaffMember = { id: string; name: string; email: string | null; role: string };

/** The signed-in coach, on a team with Staff time & pay on (else back to the dashboard). */
export async function requireStaffPay(adminOnly = false) {
  const ctx = await requireActiveOrg();
  if (!ctx.isStaff || !hasModule(ctx.org.modules, "staff")) redirect("/");
  const isAdmin = ctx.membership.role === "admin";
  if (adminOnly && !isAdmin) redirect("/staff");
  return { ...ctx, isAdmin };
}

type Ctx = Awaited<ReturnType<typeof requireStaffPay>>;

/** Admins, coaches and trainers on the team, by name. */
export async function loadStaff({ supabase, org }: Ctx): Promise<StaffMember[]> {
  const { data } = await supabase
    .from("org_memberships")
    .select("role, profile:profiles (id, full_name, email)")
    .eq("org_id", org.id)
    .in("role", ["admin", "coach", "trainer"]);
  return (data ?? [])
    .flatMap((m) =>
      m.profile
        ? [
            {
              id: m.profile.id,
              name: m.profile.full_name || m.profile.email || "Coach",
              email: m.profile.email,
              role: m.role,
            },
          ]
        : [],
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadRates({ supabase, org }: Ctx) {
  const { data } = await supabase
    .from("staff_pay_rates")
    .select("profile_id, pay_type, rate_cents, stipend_cents, stipend_payments, title")
    .eq("org_id", org.id);
  return new Map<string, Rate & { title: string | null }>(
    (data ?? []).map((r) => [r.profile_id, r]),
  );
}

export const ENTRY_COLUMNS =
  "id, profile_id, work_date, kind, started_at, ended_at, minutes, activity, note, status, amount_cents, review_note";

/**
 * What each person is owed for a date range: approved time not yet paid, plus
 * their next stipend payment. Time still waiting for approval is counted
 * separately so nothing gets missed.
 */
export async function loadPayRange(ctx: Ctx, from: string, to: string) {
  const { supabase, org } = ctx;
  const [staff, rates, { data: entries }, { data: payments }, { data: periods }] =
    await Promise.all([
      loadStaff(ctx),
      loadRates(ctx),
      supabase
        .from("staff_time_entries")
        .select(ENTRY_COLUMNS)
        .eq("org_id", org.id)
        .gte("work_date", from)
        .lte("work_date", to)
        .neq("status", "rejected")
        .limit(5000),
      supabase.from("staff_payments").select("profile_id").eq("org_id", org.id).limit(5000),
      supabase
        .from("staff_pay_periods")
        .select("id, starts_on, ends_on, status, paid_at")
        .eq("org_id", org.id)
        .order("starts_on", { ascending: false })
        .limit(24),
    ]);
  const all = entries ?? [];
  const paidCount = new Map<string, number>();
  for (const p of payments ?? [])
    paidCount.set(p.profile_id, (paidCount.get(p.profile_id) ?? 0) + 1);
  const unpaid = all.filter((e) => e.status !== "paid");
  const onStaff = new Set(staff.map((s) => s.id));
  const ids = new Set([
    ...unpaid.map((e) => e.profile_id),
    // Stipends keep going only while the person is still on staff.
    ...[...rates.entries()]
      .filter(([id, r]) => r.pay_type === "stipend" && onStaff.has(id))
      .map(([id]) => id),
  ]);
  const people = staff.filter((s) => ids.has(s.id));
  // Time from someone no longer on staff still gets paid.
  for (const id of ids)
    if (!onStaff.has(id)) people.push({ id, name: "Former staff", email: null, role: "coach" });
  const overlap = (periods ?? []).find(
    (p) => p.status === "paid" && p.starts_on <= to && p.ends_on >= from,
  );
  const totals = periodTotals(
    people.map((p) => p.id),
    unpaid,
    rates,
    // Dates already paid: only late-approved time is left; stipends aren't paid twice.
    (id) => (overlap ? Infinity : (paidCount.get(id) ?? 0) + 1),
  );
  const { data: paidRows } = overlap
    ? await supabase
        .from("staff_payments")
        .select("profile_id, amount_cents, method, reference, paid_at")
        .eq("period_id", overlap.id)
    : { data: [] };
  const paidMinutes = new Map<string, number>();
  for (const e of all)
    if (e.status === "paid")
      paidMinutes.set(e.profile_id, (paidMinutes.get(e.profile_id) ?? 0) + (e.minutes ?? 0));
  return {
    staff,
    paidRows: paidRows ?? [],
    paidMinutes,
    people,
    rates,
    entries: all,
    unpaid,
    paidCount,
    totals,
    periods: periods ?? [],
    overlap,
  };
}
