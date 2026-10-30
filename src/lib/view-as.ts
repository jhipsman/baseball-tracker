/** Cookie holding the profile id a team admin is previewing the app as (read-only). */
export const VIEW_AS_COOKIE = "dp_view_as";

/** Requests that change data. All of them are refused while previewing. */
export function isWriteRequest(method: string) {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}
