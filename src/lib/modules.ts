import "server-only";
import { notFound } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { hasModule, type ModuleKey } from "@/constants/modules";

/** 404s when the active team has this section turned off. */
export async function requireModule(key: ModuleKey) {
  const ctx = await requireActiveOrg();
  if (!hasModule(ctx.org.modules, key)) notFound();
  return ctx;
}
