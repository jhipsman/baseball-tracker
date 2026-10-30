import "server-only";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
export function teamPaymentsReady() {
  return !!(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_TEAM_WEBHOOK_SECRET &&
    (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) &&
    process.env.NEXT_PUBLIC_SITE_URL
  );
}
export function teamStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Payments are not set up yet.");
  return new Stripe(process.env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2, timeout: 15000 });
}
export function paymentAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Payment processing is unavailable.");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export function paymentSite() {
  const url = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "");
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname))
    throw new Error("Payment return address must use HTTPS.");
  return url.origin;
}
export const stripeId = (value: string | { id: string } | null | undefined) =>
  typeof value === "string" ? value : (value?.id ?? null);
