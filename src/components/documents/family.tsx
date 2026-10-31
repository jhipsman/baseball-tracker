import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { formatGameDate } from "@/lib/games";
import { DOC_KIND } from "@/lib/documents";
import { loadFamilyTasks } from "@/lib/documents-data";
import { PdfViewer } from "./pdf-viewer";
import { CompleteForm } from "./complete-form";
import { OpenFile } from "./controls";
import { cn } from "@/lib/utils";

type Base = "/player" | "/parent";
const role = (base: Base) => (base === "/player" ? "player" : "parent") as "player" | "parent";
const href = (base: Base, doc: string, subject: string) =>
  `${base}/documents/${doc}${base === "/parent" ? `?for=${subject}` : ""}`;

/** "Forms to do" card for the player/parent home (nothing when all done). */
export async function FormsCard({ base }: { base: Base }) {
  const { supabase, org, user } = await requireActiveOrg();
  const { todo } = await loadFamilyTasks(supabase, org.id, user.id, role(base));
  if (!todo.length) return null;
  return (
    <Link
      href={`${base}/documents`}
      className="flex items-center gap-3 rounded-2xl bg-amber-50 p-4 text-amber-950 ring-1 ring-amber-200"
    >
      <span aria-hidden className="text-2xl">
        ✍️
      </span>
      <span className="min-w-0 flex-1">
        <b className="block">
          {todo.length} form{todo.length === 1 ? "" : "s"} to do
        </b>
        <span className="block truncate text-sm">
          {todo
            .slice(0, 2)
            .map((t) => t.doc.title)
            .join(" · ")}
        </span>
      </span>
      <span aria-hidden>→</span>
    </Link>
  );
}

export async function FormsList({ base }: { base: Base }) {
  const { supabase, org, user } = await requireActiveOrg();
  const { items, subjects } = await loadFamilyTasks(supabase, org.id, user.id, role(base));
  const multi = subjects.length > 1;
  const todo = items.filter((i) => !i.response && i.doc.kind !== "read");
  const rest = items.filter((i) => !todo.includes(i));
  const Row = ({ i }: { i: (typeof items)[number] }) => (
    <li>
      <Link
        href={href(base, i.doc.id, i.subject.id)}
        className="flex items-center gap-3 rounded-2xl bg-surface p-4 ring-1 ring-zinc-200 hover:ring-zinc-300"
      >
        <span className="min-w-0 flex-1">
          <b className="block truncate">{i.doc.title}</b>
          <span className="block text-sm text-zinc-600">
            {DOC_KIND[i.doc.kind].action}
            {multi ? ` · for ${i.subject.name.split(" ")[0]}` : ""}
            {i.doc.due_date && !i.response ? ` · due ${formatGameDate(i.doc.due_date)}` : ""}
          </span>
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
            i.response
              ? "bg-brand-100 text-brand-900"
              : i.doc.kind === "read"
                ? "bg-zinc-100 text-zinc-600"
                : "bg-amber-100 text-amber-900",
          )}
        >
          {i.response ? "✓ Done" : i.doc.kind === "read" ? "Read" : "To do"}
        </span>
      </Link>
    </li>
  );
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-medium tracking-tight">Team forms</h1>
      {!items.length ? (
        <p className="rounded-2xl bg-surface p-5 text-sm text-zinc-600 ring-1 ring-zinc-200">
          Nothing from your team yet. Forms your coach shares show up here.
        </p>
      ) : null}
      {todo.length ? (
        <section className="space-y-2">
          <h2 className="font-semibold">To do</h2>
          <ul className="space-y-2">
            {todo.map((i) => (
              <Row key={i.doc.id + i.subject.id} i={i} />
            ))}
          </ul>
        </section>
      ) : null}
      {rest.length ? (
        <section className="space-y-2">
          <h2 className="font-semibold">{todo.length ? "Done and shared" : "All set ✓"}</h2>
          <ul className="space-y-2">
            {rest.map((i) => (
              <Row key={i.doc.id + i.subject.id} i={i} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export async function FormPage({ base, id, forId }: { base: Base; id: string; forId?: string }) {
  const { supabase, org, user } = await requireActiveOrg();
  const { items } = await loadFamilyTasks(supabase, org.id, user.id, role(base));
  const item =
    items.find((i) => i.doc.id === id && (!forId || i.subject.id === forId)) ?? notFound();
  const { doc, subject, response } = item;
  const [{ data: signed }, { data: me }] = await Promise.all([
    doc.file_path
      ? supabase.storage.from("team-docs").createSignedUrl(doc.file_path, 900)
      : Promise.resolve({ data: null }),
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
  ]);
  return (
    <div className="space-y-4">
      <Link href={`${base}/documents`} className="text-sm font-medium text-brand-700">
        ← Team forms
      </Link>
      <div>
        <h1 className="text-2xl font-medium tracking-tight">{doc.title}</h1>
        <p className="text-sm text-zinc-600">
          {DOC_KIND[doc.kind].action}
          {doc.due_date ? ` · due ${formatGameDate(doc.due_date)}` : ""}
        </p>
        {doc.description ? <p className="mt-2 text-zinc-700">{doc.description}</p> : null}
      </div>
      {signed?.signedUrl ? <PdfViewer url={signed.signedUrl} title={doc.title} /> : null}
      {response ? (
        <section
          role="status"
          className="space-y-1 rounded-2xl bg-brand-50 p-4 text-brand-900 ring-1 ring-brand-200"
        >
          <p className="font-semibold">
            ✓{" "}
            {response.kind === "signed"
              ? `Signed by ${response.signed_name}`
              : response.kind === "uploaded"
                ? "Uploaded"
                : "Confirmed"}{" "}
            on{" "}
            {new Date(response.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </p>
          {response.file_path ? (
            <OpenFile path={response.file_path} className="text-sm">
              {response.kind === "signed" ? "View the signed copy" : "View what you sent"} ↗
            </OpenFile>
          ) : null}
        </section>
      ) : (
        <CompleteForm
          docId={doc.id}
          orgId={doc.org_id}
          kind={doc.kind}
          subjectId={subject.id}
          subjectName={subject.name}
          forSelf={subject.id === user.id}
          defaultName={me?.full_name ?? ""}
        />
      )}
    </div>
  );
}
