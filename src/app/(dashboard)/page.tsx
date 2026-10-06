import type { Metadata } from "next";
import Link from "next/link";
import { requireActiveOrg } from "@/lib/org";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { supabase, user, org } = await requireActiveOrg();

  const [exercises, members, programs] = await Promise.all([
    supabase.from("exercises").select("id", { count: "exact", head: true }),
    supabase
      .from("org_memberships")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.id),
    supabase.from("programs").select("id", { count: "exact", head: true }).eq("org_id", org.id),
  ]);

  const firstName = (user.user_metadata?.full_name as string | undefined)?.split(" ")[0];
  const stats = [
    { label: "Exercises in library", value: exercises.count ?? 0, href: "/exercises" },
    { label: "Members", value: members.count ?? 0, href: "/roster" },
    { label: "Programs", value: programs.count ?? 0, href: "/programs" },
  ];

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight">
        {firstName ? `Welcome, ${firstName}` : "Welcome"}
      </h1>
      <p className="mt-1 text-sm text-zinc-600">{org.name}</p>

      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        {stats.map((s) => {
          const body = (
            <>
              <dt className="text-sm text-zinc-600">{s.label}</dt>
              <dd className="mt-1 text-3xl font-semibold tabular-nums">{s.value}</dd>
            </>
          );
          return s.href ? (
            <Link
              key={s.label}
              href={s.href}
              className="rounded-xl bg-white p-5 ring-1 ring-zinc-200 hover:ring-brand-500"
            >
              {body}
            </Link>
          ) : (
            <div key={s.label} className="rounded-xl bg-white p-5 ring-1 ring-zinc-200">
              {body}
            </div>
          );
        })}
      </dl>
    </div>
  );
}
