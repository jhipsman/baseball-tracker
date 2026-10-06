import type { Metadata } from "next";
import Link from "next/link";
import { requireActiveOrg } from "@/lib/org";
import { CATEGORY_LABELS, EXERCISE_CATEGORIES, humanize, type ExerciseCategory } from "@/constants";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Exercise library" };

function isCategory(value: unknown): value is ExerciseCategory {
  return typeof value === "string" && (EXERCISE_CATEGORIES as readonly string[]).includes(value);
}

export default async function ExercisesPage({ searchParams }: PageProps<"/exercises">) {
  const { supabase, isStaff } = await requireActiveOrg();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const category = isCategory(params.category) ? params.category : undefined;

  let query = supabase
    .from("exercises")
    .select("id, name, description, category, muscle_groups, equipment, is_custom")
    .order("category")
    .order("name");
  if (category) query = query.eq("category", category);
  if (q) query = query.ilike("name", `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);

  const { data: exercises, error } = await query;
  if (error) throw error;

  const hrefFor = (c?: ExerciseCategory) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (c) sp.set("category", c);
    const s = sp.toString();
    return s ? `/exercises?${s}` : "/exercises";
  };

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Exercise library</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {exercises.length} exercise{exercises.length === 1 ? "" : "s"}
            {category ? ` in ${CATEGORY_LABELS[category]}` : ""}
          </p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <form className="min-w-0 flex-1 sm:w-72 sm:flex-none" action="/exercises">
            {category ? <input type="hidden" name="category" value={category} /> : null}
            <label htmlFor="q" className="sr-only">
              Search exercises
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Search exercises…"
              className="block h-11 w-full rounded-lg border-0 bg-white px-3 text-base ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-brand-600 sm:text-sm"
            />
          </form>
          {isStaff ? (
            <Link
              href="/exercises/new"
              className="inline-flex h-11 shrink-0 items-center rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-600"
            >
              New exercise
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {[undefined, ...EXERCISE_CATEGORIES].map((c) => (
          <Link
            key={c ?? "all"}
            href={hrefFor(c)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset",
              c === category
                ? "bg-brand-700 text-white ring-brand-700"
                : "bg-white text-zinc-700 ring-zinc-300 hover:bg-zinc-50",
            )}
          >
            {c ? CATEGORY_LABELS[c] : "All"}
          </Link>
        ))}
      </div>

      {exercises.length === 0 ? (
        <p className="mt-10 text-center text-sm text-zinc-500">No exercises match your filters.</p>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {exercises.map((ex) => (
            <li key={ex.id} className="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-medium">{ex.name}</h2>
                <span className="shrink-0 rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-900">
                  {CATEGORY_LABELS[ex.category]}
                </span>
              </div>
              {ex.description ? (
                <p className="mt-1 text-sm text-zinc-600">{ex.description}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-1">
                {ex.muscle_groups.map((m) => (
                  <span key={m} className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-700">
                    {humanize(m)}
                  </span>
                ))}
                {ex.equipment.map((e) => (
                  <span
                    key={e}
                    className="rounded px-1.5 py-0.5 text-xs text-zinc-500 ring-1 ring-inset ring-zinc-200"
                  >
                    {humanize(e)}
                  </span>
                ))}
                {ex.is_custom ? (
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                    Custom
                  </span>
                ) : null}
                {ex.is_custom && isStaff ? (
                  <Link
                    href={`/exercises/${ex.id}/edit`}
                    className="ml-auto text-xs font-semibold text-brand-700 hover:underline"
                  >
                    Edit
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
