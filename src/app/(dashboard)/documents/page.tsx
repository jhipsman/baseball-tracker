import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { formatGameDate } from "@/lib/games";
import { playerToday } from "@/lib/player";
import { DOC_KIND } from "@/lib/documents";
import { expectedFor, loadDocPeople, loadDocuments } from "@/lib/documents-data";
import { NewDocument } from "@/components/documents/new-document";
import { Disclosure } from "@/components/ui/disclosure";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentsPage() {
  const { supabase, org, isStaff } = await requireActiveOrg();
  if (!isStaff) redirect("/");
  const { today } = await playerToday();
  const [{ docs, responses }, people] = await Promise.all([
    loadDocuments(supabase, org.id),
    loadDocPeople(supabase, org.id),
  ]);
  const active = docs.filter((d) => !d.archived);
  const archived = docs.filter((d) => d.archived);
  const groupName = (id: string | null) => people.groups.find((g) => g.id === id)?.name;

  return (
    <div className="max-w-4xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">Documents</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Forms families sign on their phone, things they upload, and rules they confirm.
          </p>
        </div>
        <Link
          href="/documents/compliance"
          className="inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold ring-1 ring-zinc-300 hover:bg-zinc-50"
        >
          Staff certifications →
        </Link>
      </header>

      {active.length ? (
        <ul className="space-y-2">
          {active.map((d) => {
            const expected = expectedFor(d, people);
            const done = responses.filter(
              (r) => r.document_id === d.id && expected.some((p) => p.id === r.subject_id),
            ).length;
            const late = d.due_date && d.due_date < today && done < expected.length;
            return (
              <li key={d.id}>
                <Link
                  href={`/documents/${d.id}`}
                  className="block rounded-2xl bg-surface p-4 ring-1 ring-zinc-200 hover:ring-zinc-300"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="min-w-0 font-semibold">{d.title}</span>
                    {d.kind === "read" ? (
                      <span className="text-sm text-zinc-500">Shared</span>
                    ) : (
                      <span className="text-sm font-semibold tabular-nums">
                        {done} of {expected.length} done
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-600">
                    {DOC_KIND[d.kind].label} ·{" "}
                    {d.audience === "staff" ? "Coaches" : (groupName(d.group_id) ?? "Whole team")}
                    {d.due_date ? (
                      <span className={cn(late && "font-semibold text-red-700")}>
                        {" "}
                        · due {formatGameDate(d.due_date)}
                      </span>
                    ) : null}
                  </p>
                  {d.kind !== "read" && expected.length ? (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className="h-full rounded-full bg-brand-600"
                        style={{ width: `${(done / expected.length) * 100}%` }}
                      />
                    </div>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-2xl bg-surface p-5 text-sm text-zinc-600 ring-1 ring-zinc-200">
          No documents yet. Add a medical release, code of conduct or anything families need to sign
          or send you.
        </p>
      )}

      <section className="rounded-2xl bg-surface p-4 ring-1 ring-zinc-200 sm:p-5">
        <Disclosure label="+ Add a document" openLabel="Hide" defaultOpen={!active.length}>
          <div className="pt-3">
            <NewDocument
              orgId={org.id}
              groups={people.groups.map((g) => ({ id: g.id, name: g.name }))}
            />
          </div>
        </Disclosure>
      </section>

      {archived.length ? (
        <p className="text-sm text-zinc-500">
          Archived:{" "}
          {archived.map((d, i) => (
            <span key={d.id}>
              {i ? ", " : ""}
              <Link href={`/documents/${d.id}`} className="underline">
                {d.title}
              </Link>
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}
