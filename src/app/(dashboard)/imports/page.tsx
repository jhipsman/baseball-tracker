import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { ImportedPlayerLink } from "./player-link";
import { SwitchWizard } from "./switch-wizard";
import { UndoImportButton } from "./undo-button";
export const metadata = { title: "Bring your team over" };
export default async function ImportsPage() {
  const { supabase, org, membership } = await requireActiveOrg();
  if (membership.role !== "admin") redirect("/");
  const { data, error } = await supabase
    .from("team_import_rows")
    .select("id,kind,source,season,values,created_at,player_id")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false })
    .limit(100);
  const { data: roster } = await supabase
    .from("org_memberships")
    .select("profile_id,profile:profiles(full_name,email)")
    .eq("org_id", org.id)
    .eq("role", "player");
  const { data: groups } = await supabase
    .from("player_groups")
    .select("id,name")
    .eq("org_id", org.id);
  const { data: batches } = await supabase
    .from("import_batches")
    .select("id, kind, source, label, summary, created_at, undone_at")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false })
    .limit(20);
  const players = (roster ?? []).map((r) => ({
    id: r.profile_id,
    name: r.profile.full_name || r.profile.email,
  }));
  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <p className="text-xs font-semibold tracking-widest text-brand-700 uppercase">Team setup</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Bring your team over.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
          Moving from GameChanger, TeamSnap, LeagueApps, SportsEngine or a spreadsheet? Upload their
          export as it is. Players don&apos;t need an email to be on the roster, parents get invited
          for their kids, and any import can be undone.
        </p>
      </header>
      <SwitchWizard teamName={org.name} groups={(groups ?? []).map((g) => g.name)} />
      {batches?.length ? (
        <section id="history" className="rounded-2xl bg-surface p-5 ring-1 ring-zinc-200">
          <h2 className="font-semibold">Your imports</h2>
          <ul className="mt-2 divide-y divide-zinc-100">
            {batches.map((b) => {
              const s = b.summary as Record<string, number>;
              const what =
                b.kind === "roster"
                  ? `${s.created ?? 0} players added, ${s.matched ?? 0} updated`
                  : b.kind === "schedule"
                    ? `${s.games ?? 0} games, ${s.practices ?? 0} practices`
                    : `${s.saved ?? 0} stat lines`;
              return (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                >
                  <span>
                    <span className="font-medium">{b.label || b.kind}</span>{" "}
                    <span className="text-zinc-500">
                      · {what} ·{" "}
                      {new Date(b.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </span>
                  {b.undone_at ? (
                    <span className="text-xs text-zinc-500">Undone</span>
                  ) : (
                    <UndoImportButton batchId={b.id} />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      <section className="rounded-xl border border-zinc-200 bg-surface p-5">
        <h2 className="font-semibold">Imported stats and records</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Past season lines from other apps, kept exactly as they were (separate from 9D&apos;s own
          season totals). Lines are matched to roster players by name and number; &ldquo;—&rdquo;
          means no match yet. Games and practices you import go straight onto the{" "}
          <Link className="text-brand-700 underline" href="/calendar">
            calendar
          </Link>
          , and players onto the{" "}
          <Link className="text-brand-700 underline" href="/roster">
            roster
          </Link>
          .
        </p>
        {error ? (
          <p className="mt-4 text-sm text-amber-800">
            Imports are temporarily unavailable. Your existing team data is safe; please try again
            shortly.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b">
                  <th className="p-2">Player / opponent</th>
                  <th className="p-2">Type</th>
                  <th className="p-2">Season · source</th>
                  <th className="p-2">Imported values</th>
                  <th className="p-2">Roster link</th>
                </tr>
              </thead>
              <tbody>
                {(data ?? []).map((row) => {
                  const values = row.values as Record<string, string>;
                  return (
                    <tr className="border-b border-zinc-100" key={row.id}>
                      <td className="p-2 font-medium">{values.name || values.opponent}</td>
                      <td className="p-2">{row.kind}</td>
                      <td className="p-2">
                        {row.season} · {row.source}
                      </td>
                      <td className="max-w-md p-2 leading-5">
                        {Object.entries(values)
                          .filter(([key]) => !["name", "opponent", "email"].includes(key))
                          .map(([key, value]) => `${key}: ${value}`)
                          .join(" · ")}
                      </td>
                      <td className="p-2">
                        {row.kind === "roster" ? (
                          <ImportedPlayerLink
                            rowId={row.id}
                            linked={row.player_id}
                            players={players}
                          />
                        ) : row.player_id ? (
                          "Linked"
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!data?.length && (
              <p className="py-4 text-sm text-zinc-500">
                No imports yet. Start with your roster above.
              </p>
            )}
            {data?.length === 100 && (
              <p className="pt-3 text-xs text-zinc-500">
                Showing the 100 most recent imported rows.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
