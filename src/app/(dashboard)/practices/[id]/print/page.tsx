import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import {
  blockTimes,
  formatDuration,
  formatPracticeDate,
  KIND_INFO,
  loadPractice,
  practiceRange,
  totalMinutes,
} from "@/lib/practices";
import { PrintButton } from "@/components/practice/print-button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Print practice" };

// The dashboard chrome (sidebar) is hidden when printing; the page fills one sheet.
const PRINT_CSS = `
@media print {
  @page { size: letter portrait; margin: 0.4in; }
  html, body { background: #fff !important; }
  body aside, body nav, .no-print { display: none !important; }
  body main { padding: 0 !important; }
  .print-sheet { box-shadow: none !important; border: 0 !important; padding: 0 !important; max-width: none !important; }
  .print-sheet tr { break-inside: avoid; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`;

export default async function PracticePrintPage({ params }: PageProps<"/practices/[id]/print">) {
  const { id } = await params;
  const { supabase, org, isStaff } = await requireActiveOrg();
  if (!isStaff) redirect(`/player/practices/${id}`);
  const plan = await loadPractice(supabase, id);
  if (!plan || plan.orgId !== org.id) notFound();

  const times = blockTimes(plan.startTime, plan.blocks);
  const total = totalMinutes(plan.blocks);
  const range = practiceRange(plan.startTime, total);

  return (
    <>
      <style>{PRINT_CSS}</style>
      <div className="no-print mb-4 flex max-w-4xl items-center justify-between gap-2">
        <Link href={`/practices/${plan.id}`} className="text-sm text-zinc-500 hover:text-zinc-800">
          ← Back to builder
        </Link>
        <PrintButton />
      </div>

      <div className="print-sheet max-w-4xl rounded-xl bg-white p-6 text-zinc-900 ring-1 ring-zinc-200">
        <header className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-zinc-900 pb-2">
          <div>
            <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              {org.name} · Practice plan
            </p>
            <h1 className="text-2xl font-bold">{plan.title}</h1>
          </div>
          <div className="text-right text-sm">
            {plan.date ? (
              <p className="font-semibold">
                {formatPracticeDate(plan.date, { weekday: "long", month: "long", year: "numeric" })}
              </p>
            ) : null}
            <p>
              {range ?? "Time TBA"} · {formatDuration(total)}
            </p>
            <p>
              {[plan.location, plan.groupName ? `${plan.groupName} only` : "Whole team"]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </header>

        {plan.notes ? (
          <p className="mt-3 rounded border border-zinc-300 p-2 text-sm whitespace-pre-line">
            <strong>Notes: </strong>
            {plan.notes}
          </p>
        ) : null}

        <table className="mt-3 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-400 text-left text-xs tracking-wide text-zinc-500 uppercase">
              <th className="w-24 py-1.5 pr-2 font-semibold">Time</th>
              <th className="py-1.5 pr-2 font-semibold">Block</th>
              <th className="w-[45%] py-1.5 font-semibold">Stations / coaches</th>
            </tr>
          </thead>
          <tbody>
            {plan.blocks.map((b, i) => {
              const kind = KIND_INFO[b.kind];
              return (
                <tr key={b.id} className="border-b border-zinc-200 align-top">
                  <td className="py-2 pr-2 font-semibold whitespace-nowrap tabular-nums">
                    {times[i].label}
                    <span className="block text-xs font-normal text-zinc-500">
                      {b.durationMin} min
                    </span>
                  </td>
                  <td className="py-2 pr-2">
                    <p className="font-semibold">
                      <span
                        aria-hidden
                        className={cn("mr-1.5 inline-block size-2.5 rounded-full", kind.dot)}
                      />
                      {b.title}{" "}
                      <span className="text-xs font-normal text-zinc-500">({kind.label})</span>
                    </p>
                    {b.details ? (
                      <p className="mt-0.5 text-xs whitespace-pre-line text-zinc-700">
                        {b.details}
                      </p>
                    ) : null}
                  </td>
                  <td className="py-2">
                    {b.stations.length > 0 ? (
                      <ul className="space-y-0.5 text-xs">
                        {b.stations.map((s, si) => (
                          <li key={si}>
                            <strong>{s.name}</strong>
                            {s.coach ? ` (${s.coach})` : ""}
                            {s.detail ? ` – ${s.detail}` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {plan.blocks.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">No blocks yet.</p>
        ) : null}
        <div className="mt-4 min-h-20 rounded border border-dashed border-zinc-300 p-2 text-xs text-zinc-400">
          Notes
        </div>
      </div>
    </>
  );
}
