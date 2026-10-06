import type { Metadata } from "next";
import Link from "next/link";
import { requireActiveOrg } from "@/lib/org";
import {
  PROGRAM_TYPE_LABELS,
  PROGRAM_TYPES,
  SEASON_PHASE_LABELS,
  SEASON_PHASES,
} from "@/constants";
import type { Enums } from "@/types/database";
import { STARTER_TEMPLATES } from "@/lib/starter-templates";
import { SubmitButton } from "@/components/ui/submit-button";
import { addStarterTemplates } from "./actions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Programs" };

export default async function ProgramsPage({ searchParams }: PageProps<"/programs">) {
  const { supabase, org, isStaff } = await requireActiveOrg();
  const params = await searchParams;
  const templates = params.view === "templates";
  const type = (PROGRAM_TYPES as readonly string[]).includes(String(params.type))
    ? (params.type as Enums<"program_type">)
    : undefined;
  const phase = (SEASON_PHASES as readonly string[]).includes(String(params.phase))
    ? (params.phase as Enums<"season_phase">)
    : undefined;
  const season = org.current_season_phase;

  const { data: programs, error } = await supabase
    .from("programs")
    .select(
      "id, name, description, program_type, season_phase, duration_weeks, is_template, updated_at, program_assignments (count)",
    )
    .eq("org_id", org.id)
    .eq("is_template", templates)
    .order("updated_at", { ascending: false });
  if (error) throw error;

  const filtered = programs
    .filter((p) => (!type || p.program_type === type) && (!phase || p.season_phase === phase))
    // Programs built for the current season first ("affects recommendations").
    .toSorted((a, b) => Number(b.season_phase === season) - Number(a.season_phase === season));

  const href = (patch: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const next = { view: templates ? "templates" : undefined, type, phase, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) sp.set(k, v);
    const q = sp.toString();
    return q ? `/programs?${q}` : "/programs";
  };

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
            { label: "Programs", href: href({ view: undefined }), active: !templates },
            { label: "Templates", href: href({ view: "templates" }), active: templates },
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

      {isStaff &&
      templates &&
      STARTER_TEMPLATES.some((t) => !programs.some((p) => p.name === t.name)) ? (
        <form
          action={addStarterTemplates}
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand-50 p-4 ring-1 ring-brand-100"
        >
          <div>
            <p className="font-medium text-brand-900">Starter throwing &amp; arm care templates</p>
            <p className="text-sm text-brand-900/80">
              {STARTER_TEMPLATES.map((t) => t.name).join(" · ")}
            </p>
          </div>
          <SubmitButton pendingLabel="Adding…">Add templates</SubmitButton>
        </form>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        {[undefined, ...PROGRAM_TYPES].map((t) => (
          <Link
            key={t ?? "all"}
            href={href({ type: t })}
            className={cn(
              "rounded-full px-3 py-1 font-medium ring-1 ring-inset",
              t === type
                ? "bg-brand-700 text-white ring-brand-700"
                : "bg-white text-zinc-700 ring-zinc-300 hover:bg-zinc-50",
            )}
          >
            {t ? PROGRAM_TYPE_LABELS[t] : "All types"}
          </Link>
        ))}
        <span className="mx-1 h-5 w-px bg-zinc-300" aria-hidden />
        {[undefined, ...SEASON_PHASES].map((ph) => (
          <Link
            key={ph ?? "any"}
            href={href({ phase: ph })}
            className={cn(
              "rounded-full px-3 py-1 font-medium ring-1 ring-inset",
              ph === phase
                ? "bg-zinc-900 text-white ring-zinc-900"
                : "bg-white text-zinc-700 ring-zinc-300 hover:bg-zinc-50",
            )}
          >
            {ph ? SEASON_PHASE_LABELS[ph] : "Any season"}
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-10 rounded-xl border-2 border-dashed border-zinc-300 p-10 text-center">
          <p className="font-medium">
            {type || phase
              ? "Nothing matches these filters"
              : templates
                ? "No templates yet"
                : isStaff
                  ? "No programs yet"
                  : "Nothing assigned yet"}
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
          {filtered.map((p) => {
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
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5",
                          p.season_phase === season
                            ? "bg-amber-100 font-medium text-amber-900"
                            : "bg-zinc-100 text-zinc-700",
                        )}
                      >
                        {p.season_phase === season ? "★ " : ""}
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
