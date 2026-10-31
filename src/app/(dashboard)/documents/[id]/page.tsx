import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { formatGameDate } from "@/lib/games";
import { DOC_KIND } from "@/lib/documents";
import { expectedFor, loadDocPeople } from "@/lib/documents-data";
import { ArchiveButton, OpenFile, RemindButton } from "@/components/documents/controls";
import type { DocumentResponseRow, TeamDocumentRow } from "@/types/team-operations";

export const metadata: Metadata = { title: "Document" };

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default async function DocumentPage({ params }: PageProps<"/documents/[id]">) {
  const { id } = await params;
  const { supabase, org, isStaff } = await requireActiveOrg();
  if (!isStaff) redirect("/");
  const { data } = await supabase
    .from("team_documents")
    .select("*")
    .eq("id", id)
    .eq("org_id", org.id)
    .maybeSingle();
  if (!data) notFound();
  const doc = data as TeamDocumentRow;
  const [people, { data: rs }] = await Promise.all([
    loadDocPeople(supabase, org.id),
    supabase.from("document_responses").select("*").eq("document_id", id),
  ]);
  const responses = (rs ?? []) as DocumentResponseRow[];
  const expected = expectedFor(doc, people);
  const ids = [...new Set(responses.map((r) => r.completed_by).filter(Boolean))] as string[];
  const { data: names } = ids.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", ids)
    : { data: [] };
  const who = (pid: string | null) => {
    const p = (names ?? []).find((n) => n.id === pid);
    return p ? p.full_name || p.email : "";
  };
  const rows = expected.map((p) => ({
    person: p,
    r: responses.find((r) => r.subject_id === p.id),
  }));
  const missing = rows.filter((x) => !x.r).length;
  const group = people.groups.find((g) => g.id === doc.group_id);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href="/documents" className="text-sm font-medium text-brand-700 hover:underline">
          ← Documents
        </Link>
        <h1 className="mt-1 text-2xl font-medium tracking-tight sm:text-3xl">{doc.title}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {DOC_KIND[doc.kind].label} ·{" "}
          {doc.audience === "staff" ? "Coaches and staff" : (group?.name ?? "Whole team")}
          {doc.due_date ? ` · due ${formatGameDate(doc.due_date)}` : ""}
          {doc.archived ? " · archived" : ""}
        </p>
        {doc.description ? <p className="mt-2 text-zinc-700">{doc.description}</p> : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {doc.file_path ? (
          <OpenFile
            path={doc.file_path}
            className="inline-flex h-11 items-center rounded-full px-4 ring-1 ring-zinc-300"
          >
            Open the PDF ↗
          </OpenFile>
        ) : null}
        {!doc.archived && doc.kind !== "read" ? (
          <RemindButton docId={doc.id} missing={missing} />
        ) : null}
        <ArchiveButton docId={doc.id} archived={doc.archived} />
      </div>

      {doc.kind === "read" ? (
        <p className="rounded-2xl bg-surface p-4 text-sm text-zinc-600 ring-1 ring-zinc-200">
          Shared with {doc.audience === "staff" ? "coaches" : "families"}; nothing to collect.
        </p>
      ) : (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">
            {expected.length - missing} of {expected.length} done
          </h2>
          <ul className="divide-y divide-zinc-100 rounded-2xl bg-surface ring-1 ring-zinc-200">
            {rows.map(({ person, r }) => (
              <li key={person.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <span className="min-w-0 flex-1 font-medium">{person.name}</span>
                {r ? (
                  <>
                    <span className="text-sm text-zinc-600">
                      ✓{" "}
                      {r.kind === "signed"
                        ? `Signed “${r.signed_name}”`
                        : r.kind === "uploaded"
                          ? "Uploaded"
                          : "Confirmed"}
                      {r.completed_by && r.completed_by !== person.id
                        ? ` by ${who(r.completed_by)}`
                        : ""}{" "}
                      · {when(r.created_at)}
                    </span>
                    {r.file_path ? (
                      <OpenFile path={r.file_path} className="text-sm">
                        {r.kind === "signed" ? "Signed copy" : "View"} ↗
                      </OpenFile>
                    ) : null}
                  </>
                ) : (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                    Not yet
                  </span>
                )}
              </li>
            ))}
            {!rows.length ? (
              <li className="px-4 py-3 text-sm text-zinc-500">Nobody in this group yet.</li>
            ) : null}
          </ul>
        </section>
      )}
    </div>
  );
}
