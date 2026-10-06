import "server-only";

import { headers } from "next/headers";
import { resolveOrigin } from "./origin";

/**
 * Public origin for links we hand to other people (invites, email confirmations).
 * Never a protected per-deployment Vercel URL; see resolveOrigin.
 */
export async function siteOrigin() {
  return resolveOrigin(process.env, await headers());
}
