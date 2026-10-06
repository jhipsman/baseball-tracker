"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_ORG_COOKIE } from "@/lib/org";
import { siteOrigin } from "@/lib/site";
import { safeRedirectPath } from "@/lib/utils";

export type FormState = {
  error?: string;
  message?: string;
  /** Submitted values echoed back, since React resets the form after an action. */
  values?: Record<string, string>;
};

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeRedirectPath(String(formData.get("next") ?? ""));

  const values = { email };

  if (!email || !password) return { error: "Email and password are required.", values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message, values };

  redirect(next);
}

export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeRedirectPath(String(formData.get("next") ?? ""), "/onboarding");

  const values = { full_name: fullName, email };

  if (!fullName || !email || !password) return { error: "All fields are required.", values };
  if (password.length < 8) return { error: "Password must be at least 8 characters.", values };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { error: error.message, values };

  // Email confirmation disabled → we already have a session.
  if (data.session) redirect(next);

  return { message: "Check your email for a confirmation link to finish signing up." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete(ACTIVE_ORG_COOKIE);
  redirect("/login");
}

export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter your email." };

  const supabase = await createClient();
  // Same response whether or not the account exists, so emails can't be probed.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteOrigin()}/auth/callback?next=/reset-password`,
  });
  return {
    message: "If there's an account for that email, a reset link is on its way. Check your inbox.",
    values: { email },
  };
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "Passwords don't match." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  redirect("/");
}
