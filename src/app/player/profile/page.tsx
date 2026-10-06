import type { Metadata } from "next";
import { requireActiveOrg } from "@/lib/org";
import { signOut } from "@/lib/auth/actions";
import { ROLE_LABELS } from "@/constants";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const { supabase, user, org, membership } = await requireActiveOrg();
  const [{ data: profile }, { data: details }] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", user.id).single(),
    supabase
      .from("org_memberships")
      .select("position, jersey_number")
      .eq("id", membership.id)
      .single(),
  ]);

  const facts = [
    ["Team", org.name],
    ["Role", ROLE_LABELS[membership.role]],
    ["Position", details?.position ?? "—"],
    ["Jersey", details?.jersey_number != null ? `#${details.jersey_number}` : "—"],
    ["Email", profile?.email ?? user.email ?? ""],
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
      <section className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
        <ProfileForm fullName={profile?.full_name ?? ""} />
      </section>
      <dl className="divide-y divide-zinc-100 rounded-2xl bg-white px-4 ring-1 ring-zinc-200">
        {facts.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-3 text-sm">
            <dt className="text-zinc-500">{k}</dt>
            <dd className="truncate font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="px-1 text-xs text-zinc-500">
        Tip: add this app to your home screen from your browser&apos;s share menu for one-tap
        access.
      </p>
      <form action={signOut}>
        <button
          type="submit"
          className="h-12 w-full rounded-xl text-sm font-semibold text-red-700 ring-1 ring-inset ring-zinc-300"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
