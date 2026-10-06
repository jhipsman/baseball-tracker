type Env = Partial<Record<string, string>>;
type HeaderLike = { get(name: string): string | null };

function withProtocol(value: string) {
  const v = value.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

/**
 * Pick the origin for shareable links, in order:
 * 1. NEXT_PUBLIC_SITE_URL (explicit, e.g. a custom domain);
 * 2. VERCEL_PROJECT_PRODUCTION_URL (Vercel's public production domain, set automatically).
 *    Per-deployment URLs (…-git-branch-….vercel.app) sit behind Vercel's login wall, so
 *    links must never use the host the coach happened to be browsing on;
 * 3. the request's own host (local dev / LAN).
 */
export function resolveOrigin(env: Env, h: HeaderLike) {
  if (env.NEXT_PUBLIC_SITE_URL?.trim()) return withProtocol(env.NEXT_PUBLIC_SITE_URL);
  if (env.VERCEL_PROJECT_PRODUCTION_URL?.trim()) {
    return withProtocol(env.VERCEL_PROJECT_PRODUCTION_URL);
  }
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const local = /^(localhost|127\.|\[::1\]|192\.168\.|10\.|172\.)/.test(host);
  const proto = h.get("x-forwarded-proto") ?? (local ? "http" : "https");
  return `${proto}://${host}`;
}
