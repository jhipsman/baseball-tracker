import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { playerToday } from "@/lib/player";
import { formatGameDate } from "@/lib/games";
import { CREDENTIALS, credentialStatus, type CredentialStatus } from "@/lib/documents";
import { loadDocPeople } from "@/lib/documents-data";
import { CredentialForm, RemoveCredential } from "@/components/documents/credential-form";
import { OpenFile } from "@/components/documents/controls";
import type { StaffCredentialRow } from "@/types/team-operations";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Staff certifications" };

const STATUS: Record<CredentialStatus, { text: string; tone: string }> = {
  current: { text: "✓ Current", tone: "bg-brand-100 text-brand-900" },
  expiring: { text: "⚠ Expires soon", tone: "bg-amber-100 text-amber-900" },
  expired: { text: "⛔ Expired", tone: "bg-red-100 text-red-800" },
  missing: { text: "Missing", tone: "bg-zinc-100 text-zinc-600" },
};
const REQUIRED = CREDENTIALS.filter((c) => c.key !== "other");

export default async function CompliancePage() {
  const { supabase, org, user, isStaff, membership } = await requireActiveOrg();
  if (!isStaff) redirect("/");
  const admin = membership.role === "admin";
  const { today } = await playerToday();
  const [{ data }, people] = await Promise.all([
    supabase
      .from("staff_credentials")
      .select("*")
      .eq("org_id", org.id)
      .order("created_at", { ascending: false }),
    loadDocPeople(supabase, org.id),
  ]);
  const certs = (data ?? []) as StaffCredentialRow[];
  const mine = certs.filter((c) => c.profile_id === user.id);
  const label = (c: StaffCredentialRow) =>
    c.kind === "other" ? c.label || "Other" : CREDENTIALS.find((k) => k.key === c.kind)!.label;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Link href="/documents" className="text-sm font-medium text-brand-700 hover:underline">
          ← Documents
        </Link>
        <h1 className="mt-1 text-2xl font-medium tracking-tight sm:text-3xl">
          Staff certifications
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Background checks and training certificates, with expiry dates. Only team admins and the
          coach can see them.
        </p>
      </div>

      {admin ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Your staff</h2>
          <div className="overflow-x-auto rounded-2xl bg-surface ring-1 ring-zinc-200">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
                  <th className="sticky left-0 bg-surface-solid px-4 py-2.5 font-medium">Coach</th>
                  {REQUIRED.map((k) => (
                    <th key={k.key} className="px-3 py-2.5 font-medium">
                      {k.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {people.staff.map((p) => (
                  <tr key={p.id} className="border-b border-zinc-100 last:border-0">
                    <td className="sticky left-0 bg-surface-solid px-4 py-3 font-medium">
                      {p.name}
                    </td>
                    {REQUIRED.map((k) => {
                      const s = credentialStatus(
                        certs.filter((c) => c.profile_id === p.id && c.kind === k.key),
                        today,
                      );
                      return (
                        <td key={k.key} className="px-3 py-3">
                          <span
                            className={cn(
                              "inline-block rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
                              STATUS[s.status].tone,
                            )}
                          >
                            {STATUS[s.status].text}
                          </span>
                          {s.expires ? (
                            <span className="mt-0.5 block text-xs text-zinc-500">
                              {s.status === "expired" ? "Expired" : "Until"}{" "}
                              {formatGameDate(s.expires)}
                            </span>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="space-y-3 rounded-2xl bg-surface p-4 ring-1 ring-zinc-200 sm:p-5">
        <h2 className="text-lg font-semibold">Your certifications</h2>
        {mine.length ? (
          <ul className="divide-y divide-zinc-100">
            {mine.map((c) => {
              const s = credentialStatus([c], today);
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                  <span className="min-w-0 flex-1 font-medium">{label(c)}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold",
                      STATUS[s.status].tone,
                    )}
                  >
                    {STATUS[s.status].text}
                    {c.expires_on ? ` · ${formatGameDate(c.expires_on)}` : ""}
                  </span>
                  <OpenFile path={c.file_path} className="text-sm">
                    View ↗
                  </OpenFile>
                  <RemoveCredential id={c.id} />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-zinc-600">None yet.</p>
        )}
        <div className="border-t border-zinc-100 pt-4">
          <CredentialForm orgId={org.id} userId={user.id} />
        </div>
      </section>

      {admin
        ? (() => {
            const others = certs.filter((c) => c.profile_id !== user.id);
            if (!others.length) return null;
            const name = (id: string) => people.staff.find((p) => p.id === id)?.name ?? "Coach";
            return (
              <section className="space-y-2">
                <h2 className="text-lg font-semibold">All uploaded certificates</h2>
                <ul className="divide-y divide-zinc-100 rounded-2xl bg-surface ring-1 ring-zinc-200">
                  {others.map((c) => (
                    <li
                      key={c.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm"
                    >
                      <span className="min-w-0 flex-1">
                        <b>{name(c.profile_id)}</b> · {label(c)}
                        {c.expires_on ? ` · until ${formatGameDate(c.expires_on)}` : ""}
                      </span>
                      <OpenFile path={c.file_path}>View ↗</OpenFile>
                      <RemoveCredential id={c.id} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })()
        : null}
    </div>
  );
}
