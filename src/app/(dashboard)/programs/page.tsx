import type { Metadata } from "next";
import Link from "next/link";
import { requireActiveOrg } from "@/lib/org";
import { PROGRAM_TYPE_LABELS, SEASON_PHASE_LABELS } from "@/constants";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Programs" };

export default async function ProgramsPage({ searchParams }: PageProps<"/programs">) {
  const { supabase, org, isStaff } = await requireActiveOrg();
  const { view } = await searchParams;
  const templates = view === "templates";

  const { data: programs, error } = await supabase
    .from("programs")
    .select(
      "id, name, description, program_type, season_phase, duration_weeks, is_template, updated_at, program_assignments (count)",
    )
    .eq("org_id", org.id)
    .eq("is_template", templates)
    .order("updated_at", { ascending: false });
  if (error) throw error;

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Programs</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {isStaff
              ? "Build training blocks, save templates, and assign them to players."
              : "Programs assigned to you."}
          </p>
        </div>
        {isStaff ? (
          <Link
            href="/programs/new"
            className="inline-flex h-11 items-center rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-600"
          >
            New program
          </Link>
        ) : null}
      </div>

      {isStaff ? (
        <div className="mt-6 flex gap-1 border-b border-zinc-200">
          {[
            { label: "Programs", href: "/programs", active: !templates },
            { label: "Templates", href: "/programs?view=templates", active: templates },
          ].map((t) => (
            <Link
              key={t.label}
              href={t.href}
              aria-current={t.active ? "page" : undefined}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
                t.active
                  ? "border-brand-700 text-brand-900"
                  : "border-transparent text-zinc-500 hover:text-zinc-800",
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>
      ) : null}

      {programs.length === 0 ? (
        <div className="mt-10 rounded-xl border-2 border-dashed border-zinc-300 p-10 text-center">
          <p className="font-medium">
            {templates ? "No templates yet" : isStaff ? "No programs yet" : "Nothing assigned yet"}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {templates
              ? "Open any program and choose “Save as template” to reuse it."
              : isStaff
                ? "Create your first training program to get started."
                : "Your coach will assign programs here."}
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {programs.map((p) => {
            const assigned = p.program_assignments[0]?.count ?? 0;
            return (
              <li key={p.id}>
                <Link
                  href={`/programs/${p.id}`}
                  className="block h-full rounded-xl bg-white p-4 ring-1 ring-zinc-200 hover:ring-brand-500"
                >
                  <h2 className="font-semibold">{p.name}</h2>
                  {p.description ? (
                    <p className="mt-1 line-clamp-2 text-sm text-zinc-600">{p.description}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                    <span className="rounded bg-brand-50 px-1.5 py-0.5 font-medium text-brand-900">
                      {PROGRAM_TYPE_LABELS[p.program_type]}
                    </span>
                    {p.season_phase ? (
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-700">
                        {SEASON_PHASE_LABELS[p.season_phase]}
                      </span>
                    ) : null}
                    {p.duration_weeks ? (
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-700">
                        {p.duration_weeks} week{p.duration_weeks === 1 ? "" : "s"}
                      </span>
                    ) : null}
                    {isStaff && !p.is_template ? (
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-700">
                        {assigned} assignment{assigned === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
