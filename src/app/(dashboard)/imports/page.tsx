import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { ImportWizard } from "./wizard";
export const metadata = { title: "Bring your team over" };
export default async function ImportsPage() {
  const { supabase, org, membership } = await requireActiveOrg();
  if (membership.role !== "admin") redirect("/");
  const { data, error } = await supabase
    .from("team_import_rows")
    .select("id,kind,source,season,values,created_at")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false })
    .limit(100);
  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <p className="text-xs font-semibold tracking-widest text-brand-700 uppercase">Team setup</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Bring your team over.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
          Your roster, schedule, and history belong with your team. Start with a spreadsheet or an
          export from the app you use today.
        </p>
      </header>
      <ImportWizard />
      <section className="rounded-xl border border-zinc-200 bg-surface p-5">
        <h2 className="font-semibold">Imported data</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Schedules appear in{" "}
          <Link className="text-brand-700 underline" href="/games">
            Games
          </Link>
          . Imported players stay here without creating accounts or sending invitations. Historical
          stats remain source snapshots, separate from live season totals. Use{" "}
          <Link className="text-brand-700 underline" href="/roster">
            Roster
          </Link>{" "}
          to invite players when you’re ready.
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
