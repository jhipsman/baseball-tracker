import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { isNone, parseContacts, telHref } from "@/lib/medical";
import { PrintButton } from "@/components/practice/print-button";
import { EmergencyPlanForm } from "@/components/health/medical-form";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Medical cards" };

/** Game-day medical cards for the whole roster: allergies first, tap to call. Coaches only. */
export default async function MedicalCardsPage({ searchParams }: PageProps<"/throwing/medical">) {
  const { supabase, org, isStaff, membership } = await requireActiveOrg();
  if (!isStaff) redirect("/");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const [{ data: cards }, { data: team }] = await Promise.all([
    supabase.rpc("medical_cards", { p_org: org.id }),
    supabase.from("organizations").select("emergency_plan").eq("id", org.id).maybeSingle(),
  ]);
  const all = cards ?? [];
  const shown = q ? all.filter((c) => c.full_name.toLowerCase().includes(q)) : all;
  const flagged = all.filter((c) => !isNone(c.allergies) || !isNone(c.medications));
  const missing = all.filter(
    (c) => !c.updated_at && !c.registration_notes && !parseContacts(c.contacts).length,
  );
  const plan = team?.emergency_plan ?? "";

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">Medical cards</h1>
          <p className="text-sm text-zinc-600">
            For game day. Families keep these current; only coaches see the whole team.
          </p>
        </div>
        <div className="print:hidden">
          <PrintButton />
        </div>
      </div>

      <section
        aria-labelledby="eap"
        className="space-y-3 rounded-2xl bg-red-50 p-4 text-red-950 ring-1 ring-red-200 sm:p-5"
      >
        <h2 id="eap" className="text-lg font-semibold">
          🚑 Emergency plan
        </h2>
        {plan ? (
          <p className="text-sm whitespace-pre-line" data-testid="emergency-plan">
            {plan}
          </p>
        ) : (
          <p className="text-sm">
            No plan yet. {membership.role === "admin" ? "Add" : "Ask an admin to add"} the nearest
            ER, where the AED is, and who calls 911.
          </p>
        )}
        <p className="text-sm font-semibold">
          In an emergency, call{" "}
          <a href="tel:911" className="underline">
            911
          </a>{" "}
          first.
        </p>
        {membership.role === "admin" ? (
          <div className="rounded-xl bg-surface p-3 text-zinc-900 ring-1 ring-zinc-200">
            <EmergencyPlanForm initial={plan} />
          </div>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded-full bg-red-100 px-3 py-1 font-semibold text-red-900">
          {flagged.length} with allergies or medications
        </span>
        {missing.length ? (
          <span className="rounded-full bg-zinc-100 px-3 py-1 font-medium text-zinc-700">
            {missing.length} without a card yet
          </span>
        ) : null}
      </div>

      <form className="print:hidden" role="search">
        <label className="block max-w-sm text-sm font-medium">
          Find a player
          <input
            name="q"
            defaultValue={q}
            type="search"
            className="mt-1 block h-11 w-full rounded-lg bg-surface px-3 ring-1 ring-zinc-300"
          />
        </label>
      </form>

      {shown.length ? (
        <ul className="grid gap-3 md:grid-cols-2 print:grid-cols-2">
          {shown.map((c) => {
            const contacts = parseContacts(c.contacts);
            const alert = !isNone(c.allergies);
            return (
              <li
                key={c.player_id}
                data-testid="medical-card"
                className={cn(
                  "space-y-2 rounded-2xl bg-surface p-4 ring-1 break-inside-avoid",
                  alert ? "ring-red-300" : "ring-zinc-200",
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <Link href={`/throwing/${c.player_id}`} className="font-semibold hover:underline">
                    {c.jersey_number != null ? (
                      <span className="mr-1 text-zinc-400">#{c.jersey_number}</span>
                    ) : null}
                    {c.full_name}
                  </Link>
                  {c.birth_date ? (
                    <span className="text-xs text-zinc-500">
                      DOB{" "}
                      {new Date(`${c.birth_date}T12:00:00Z`).toLocaleDateString("en-US", {
                        month: "numeric",
                        day: "numeric",
                        year: "numeric",
                        timeZone: "UTC",
                      })}
                    </span>
                  ) : null}
                </div>
                <dl className="grid grid-cols-[6.5rem_1fr] gap-x-2 gap-y-1 text-sm">
                  <dt className="text-zinc-500">Allergies</dt>
                  <dd className={alert ? "font-semibold text-red-800" : ""}>
                    {alert ? `⚠ ${c.allergies}` : c.allergies || "—"}
                  </dd>
                  <dt className="text-zinc-500">Medications</dt>
                  <dd>{c.medications || "—"}</dd>
                  {c.conditions ? (
                    <>
                      <dt className="text-zinc-500">Conditions</dt>
                      <dd>{c.conditions}</dd>
                    </>
                  ) : null}
                  {c.registration_notes && !c.updated_at ? (
                    <>
                      <dt className="text-zinc-500">From registration</dt>
                      <dd>{c.registration_notes}</dd>
                    </>
                  ) : null}
                </dl>
                {contacts.length ? (
                  <ul className="space-y-1 border-t border-zinc-100 pt-2">
                    {contacts.map((k, i) => {
                      const tel = telHref(k.phone);
                      return (
                        <li
                          key={i}
                          className="flex flex-wrap items-center justify-between gap-2 text-sm"
                        >
                          <span>
                            <span className="font-medium">{k.name || "Contact"}</span>
                            {k.relation ? (
                              <span className="text-zinc-500"> · {k.relation}</span>
                            ) : null}
                          </span>
                          {tel ? (
                            <a
                              href={tel}
                              className="inline-flex min-h-11 items-center gap-1 rounded-full bg-brand-50 px-3 font-semibold text-brand-800 ring-1 ring-brand-200"
                            >
                              📞 {k.phone}
                            </a>
                          ) : (
                            <span>{k.phone}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="border-t border-zinc-100 pt-2 text-sm text-zinc-500">
                    No emergency contact yet. Families add it under Medical card.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-2xl bg-surface p-6 text-sm text-zinc-600 ring-1 ring-zinc-200">
          {q ? "No player matches." : "No players on the roster yet."}
        </p>
      )}
    </div>
  );
}
