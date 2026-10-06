"use server";

import { redirect } from "next/navigation";
import { getMemberships, setActiveOrgCookie } from "@/lib/org";

export async function switchOrg(formData: FormData) {
  const orgId = String(formData.get("org_id") ?? "");
  const memberships = await getMemberships();
  if (memberships.some((m) => m.org.id === orgId)) await setActiveOrgCookie(orgId);
  redirect("/");
}
