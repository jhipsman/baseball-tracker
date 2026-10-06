"use server";

import { redirect } from "next/navigation";
import { setActiveOrgCookie } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";

export async function acceptInvitation(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const supabase = await createClient();
  const { data: orgId, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error)
    redirect(`/invite/${encodeURIComponent(token)}?error=${encodeURIComponent(error.message)}`);

  await setActiveOrgCookie(orgId);
  redirect("/");
}
