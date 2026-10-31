import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { money } from "@/lib/team-payments";
import { DEFAULT_WAIVER } from "@/constants/registration";
import { RegistrationFormBuilder } from "@/components/registration/form-builder";
import { Disclosure } from "@/components/ui/disclosure";

export const metadata: Metadata = { title: "Registration" };

export default async function RegistrationPage() {
  const { supabase, org, membership } = await requireActiveOrg();
  if (membership.role !== "admin") redirect("/");
  const [{ data: forms }, { data: regs }] = await Promise.all([
    supabase
      .from("registration_forms")
      .select("id, title, season, fee_cents, installments_max, capacity, open, created_at")
      .eq("org_id", org.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("team_registrations")
      .select("form_id, status")
      .eq("org_id", org.id)
      .eq("status", "registered"),
  ]);
  const count = (id: string) => (regs ?? []).filter((r) => r.form_id === id).length;

  return (
    <div className="max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">Registration</h1>
        <p className="mt-1 text-sm text-zinc-600">
          One link for the season. Families fill in player and emergency info, sign the waiver and
          pay in full or monthly. They join the team as they register.
        </p>
      </header>

      {forms?.length ? (
        <ul className="space-y-2">
          {forms.map((f) => (
            <li key={f.id}>
              <Link
                href={`/registration/${f.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl bg-surface p-4 ring-1 ring-zinc-200 hover:ring-zinc-300"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{f.title}</span>
                  <span className="text-sm text-zinc-600">
                    {f.fee_cents ? money(f.fee_cents) : "Free"}
                    {f.installments_max > 1 ? ` · up to ${f.installments_max} payments` : ""}
                  </span>
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {count(f.id)}
                  {f.capacity ? ` / ${f.capacity}` : ""} registered
                </span>
                <span
                  className={
                    f.open
                      ? "rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-900"
                      : "rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-600"
                  }
                >
                  {f.open ? "Open" : "Closed"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <section className="rounded-2xl bg-surface p-4 ring-1 ring-zinc-200 sm:p-5">
        {forms?.length ? (
          <Disclosure label="+ New registration link" openLabel="Hide">
            <div className="pt-3">
              <RegistrationFormBuilder waiver={DEFAULT_WAIVER} />
            </div>
          </Disclosure>
        ) : (
          <>
            <h2 className="mb-3 text-lg font-semibold">Set up season registration</h2>
            <RegistrationFormBuilder waiver={DEFAULT_WAIVER} />
          </>
        )}
      </section>
    </div>
  );
}
