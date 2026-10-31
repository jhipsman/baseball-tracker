import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { playerToday } from "@/lib/player";
import { formatGameDate } from "@/lib/games";
import { money } from "@/lib/team-payments";
import { ageOn } from "@/lib/workload";
import { loadTeam } from "@/lib/team";
import { CopyLink, OpenToggle, RegistrationActions } from "@/components/registration/controls";

export const metadata: Metadata = { title: "Registration" };

export default async function RegistrationFormPage({ params }: PageProps<"/registration/[id]">) {
  const { id } = await params;
  const { supabase, org, membership } = await requireActiveOrg();
  if (membership.role !== "admin") redirect("/");
  const { today } = await playerToday();
  const { data: form } = await supabase
    .from("registration_forms")
    .select("*")
    .eq("id", id)
    .eq("org_id", org.id)
    .maybeSingle();
  if (!form) notFound();
  const [{ data: regs }, team] = await Promise.all([
    supabase
      .from("team_registrations")
      .select("*")
      .eq("form_id", id)
      .order("created_at", { ascending: false }),
    loadTeam(supabase, org.id, today, today, today),
  ]);
  const planIds = (regs ?? []).flatMap((r) => (r.plan_id ? [r.plan_id] : []));
  const { data: invoices } = planIds.length
    ? await supabase
        .from("team_invoices")
        .select("plan_id, amount_cents, paid_cents, status")
        .in("plan_id", planIds)
    : { data: [] };
  const paid = (planId: string | null) => {
    const mine = (invoices ?? []).filter((i) => i.plan_id === planId && i.status !== "void");
    return {
      paid: mine.reduce((n, i) => n + i.paid_cents, 0),
      due: mine.reduce((n, i) => n + i.amount_cents, 0),
    };
  };
  const active = (regs ?? []).filter((r) => r.status === "registered");
  const withdrawn = (regs ?? []).filter((r) => r.status !== "registered");
  const collected = active.reduce((n, r) => n + paid(r.plan_id).paid, 0);
  const expected = active.reduce((n, r) => n + paid(r.plan_id).due, 0);
  const name = (pid: string | null) => team.players.find((p) => p.id === pid)?.name;
  const linkedIds = new Set(active.map((r) => r.player_id).filter(Boolean));
  const unlinkedPlayers = team.players
    .filter((p) => !linkedIds.has(p.id))
    .map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Link href="/registration" className="text-sm font-medium text-brand-700 hover:underline">
          ← Registration
        </Link>
        <h1 className="mt-1 text-2xl font-medium tracking-tight sm:text-3xl">{form.title}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {form.season} · {form.fee_cents ? money(form.fee_cents) : "Free"}
          {form.installments_max > 1 ? ` · in full or up to ${form.installments_max} payments` : ""}
          {form.first_due ? ` · first payment ${formatGameDate(form.first_due)}` : ""}
        </p>
      </div>

      <section className="space-y-3 rounded-2xl bg-surface p-4 ring-1 ring-zinc-200 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">
            {form.open ? "Share this link with families" : "Registration is closed"}
          </h2>
          <OpenToggle formId={form.id} open={form.open} />
        </div>
        {form.open ? <CopyLink token={form.token} /> : null}
        <dl className="grid grid-cols-3 gap-3 border-t border-zinc-100 pt-3 text-center">
          <div>
            <dt className="text-xs text-zinc-500">Registered</dt>
            <dd className="text-2xl font-semibold tabular-nums">
              {active.length}
              {form.capacity ? (
                <span className="text-base text-zinc-500"> / {form.capacity}</span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Collected</dt>
            <dd className="text-2xl font-semibold tabular-nums">{money(collected)}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Still due</dt>
            <dd className="text-2xl font-semibold tabular-nums">{money(expected - collected)}</dd>
          </div>
        </dl>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Players</h2>
        {active.length === 0 ? (
          <p className="rounded-2xl bg-surface p-4 text-sm text-zinc-600 ring-1 ring-zinc-200">
            No one yet. Families who use the link show up here right away.
          </p>
        ) : (
          <ul className="space-y-2">
            {active.map((r) => {
              const p = paid(r.plan_id);
              return (
                <li key={r.id} className="rounded-2xl bg-surface p-4 ring-1 ring-zinc-200">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {r.player_name}
                        <span className="ml-2 text-sm font-normal text-zinc-500">
                          age {ageOn(r.player_birth_date, today)}
                          {r.player_position ? ` · ${r.player_position}` : ""}
                        </span>
                      </p>
                      <p className="text-sm text-zinc-600">
                        {r.parent_name} ·{" "}
                        <a href={`tel:${r.parent_phone}`} className="text-brand-700">
                          {r.parent_phone}
                        </a>{" "}
                        · {r.parent_email}
                      </p>
                    </div>
                    <span
                      className={
                        !r.plan_id
                          ? "rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-600"
                          : p.paid >= p.due
                            ? "rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-900"
                            : "rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900"
                      }
                    >
                      {!r.plan_id
                        ? "No fee"
                        : p.paid >= p.due
                          ? "✓ Paid"
                          : `${money(p.paid)} of ${money(p.due)} paid`}
                    </span>
                  </div>
                  <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                    <div className="flex gap-2">
                      <dt className="text-zinc-500">Emergency</dt>
                      <dd>
                        {r.emergency_name}
                        {r.emergency_relation ? ` (${r.emergency_relation})` : ""} ·{" "}
                        <a href={`tel:${r.emergency_phone}`} className="text-brand-700">
                          {r.emergency_phone}
                        </a>
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-zinc-500">Waiver</dt>
                      <dd>
                        ✓ Signed “{r.waiver_signed_name}” on{" "}
                        {formatGameDate(r.waiver_signed_at.slice(0, 10))}
                      </dd>
                    </div>
                    {r.medical_notes ? (
                      <div className="flex gap-2 sm:col-span-2">
                        <dt className="text-red-700">Medical</dt>
                        <dd className="text-zinc-800">{r.medical_notes}</dd>
                      </div>
                    ) : null}
                    <div className="flex gap-2 sm:col-span-2">
                      <dt className="text-zinc-500">On the roster</dt>
                      <dd>
                        {r.player_id
                          ? `✓ ${name(r.player_id) ?? "Linked"}`
                          : r.player_email
                            ? `Invite sent to ${r.player_email}`
                            : "Not yet: no player email given. Invite them from Members & invites, then link here."}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-3 border-t border-zinc-100 pt-3">
                    <RegistrationActions
                      regId={r.id}
                      linked={!!r.player_id}
                      players={unlinkedPlayers}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {withdrawn.length ? (
          <p className="text-sm text-zinc-500">
            Withdrawn: {withdrawn.map((r) => r.player_name).join(", ")}
          </p>
        ) : null}
      </section>
    </div>
  );
}
