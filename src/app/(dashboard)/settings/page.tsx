import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { cleanModules } from "@/constants/modules";
import { SubmitButton } from "@/components/ui/submit-button";
import { openDemoTeam, removeDemoTeam } from "@/lib/demo-actions";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { supabase, org, membership, memberships } = await requireActiveOrg();
  if (membership.role !== "admin") redirect("/");

  const [{ data: members }, { data: links }] = await Promise.all([
    supabase
      .from("org_memberships")
      .select("role, jersey_number, position, profile:profiles (id, full_name, email)")
      .eq("org_id", org.id)
      .in("role", ["player", "parent"]),
    supabase.from("parent_links").select("parent_id, player_id").eq("org_id", org.id),
  ]);
  const nameOf = new Map(
    (members ?? []).map((m) => [m.profile.id, m.profile.full_name || m.profile.email]),
  );
  const byName = (a: { profile: { full_name: string | null } }, b: typeof a) =>
    (a.profile.full_name ?? "").localeCompare(b.profile.full_name ?? "");
  const players = (members ?? []).filter((m) => m.role === "player").toSorted(byName);
  const parents = (members ?? []).filter((m) => m.role === "parent").toSorted(byName);
  const childrenOf = (id: string) =>
    (links ?? [])
      .filter((l) => l.parent_id === id)
      .map((l) => nameOf.get(l.player_id))
      .filter(Boolean)
      .join(", ");
  const demo = memberships.find((m) => m.org.is_demo && m.role === "admin");

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">Team settings</h1>
        <p className="mt-1 text-sm text-zinc-600">{org.name}</p>
      </div>
      <Link
        href="/imports"
        className="block rounded-xl border border-brand-200 bg-brand-50 p-5 text-sm font-medium text-brand-800"
      >
        Bring your team over →{" "}
        <span className="mt-1 block text-xs font-normal">
          Import a roster, schedule, and historical stats from spreadsheets or another app.
        </span>
      </Link>
      <SettingsForm teamType={org.team_type} modules={cleanModules(org.modules)} />

      <section id="preview" className="scroll-mt-6 rounded-xl bg-surface p-5 ring-1 ring-zinc-200">
        <h2 className="font-semibold">Preview the app</h2>
        <p className="mt-1 text-sm text-zinc-600">
          See exactly what a player or parent sees on their phone. It&apos;s read-only: nothing you
          tap changes anything, and they aren&apos;t notified.
        </p>
        {players.length + parents.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            No players or parents on this team yet. Try it on a demo team below.
          </p>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {[
              { title: "Players", list: players },
              { title: "Parents", list: parents },
            ].map(({ title, list }) =>
              list.length ? (
                <div key={title}>
                  <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                    {title}
                  </h3>
                  <ul className="mt-1 divide-y divide-zinc-100">
                    {list.map((m) => (
                      <li key={m.profile.id}>
                        {/* A plain link: prefetching this would start a preview. */}
                        <a
                          href={`/view-as?id=${m.profile.id}`}
                          className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm hover:text-brand-700"
                        >
                          <span className="min-w-0 truncate">
                            {m.profile.full_name || m.profile.email}
                            <span className="ml-1.5 text-xs text-zinc-500">
                              {m.role === "parent"
                                ? childrenOf(m.profile.id) &&
                                  `parent of ${childrenOf(m.profile.id)}`
                                : [m.jersey_number != null ? `#${m.jersey_number}` : "", m.position]
                                    .filter(Boolean)
                                    .join(" ")}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs font-semibold text-brand-700">
                            View as →
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null,
            )}
          </div>
        )}
      </section>

      <section className="rounded-xl bg-surface p-5 ring-1 ring-zinc-200">
        <h2 className="font-semibold">Demo team</h2>
        {org.is_demo ? (
          <>
            <p className="mt-1 text-sm text-zinc-600">
              You&apos;re in your demo team. Everyone on it is made up, and nobody can sign in as
              them, so click around freely. Delete it any time; your real teams aren&apos;t
              affected.
            </p>
            <form action={removeDemoTeam} className="mt-3">
              <input type="hidden" name="org_id" value={org.id} />
              <SubmitButton variant="secondary" pendingLabel="Deleting…">
                Delete demo team
              </SubmitButton>
            </form>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-zinc-600">
              A sample team with 12 made-up players, parents, three weeks of workouts and games, an
              arm-pain report, practices and dues. Use it to show the app to another coach or to try
              any screen without touching your real team.
            </p>
            <form action={openDemoTeam} className="mt-3">
              <SubmitButton variant="secondary" pendingLabel="Building the demo team…">
                {demo ? "Open demo team" : "Create demo team"}
              </SubmitButton>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
