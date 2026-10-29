import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { cleanModules } from "@/constants/modules";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { org, membership } = await requireActiveOrg();
  if (membership.role !== "admin") redirect("/");

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team settings</h1>
        <p className="mt-1 text-sm text-zinc-600">{org.name}</p>
      </div>
      <SettingsForm teamType={org.team_type} modules={cleanModules(org.modules)} />
    </div>
  );
}
