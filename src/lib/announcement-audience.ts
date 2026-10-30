import "server-only";
import { createHash } from "node:crypto";
export function audienceFingerprint(ids: string[]) {
  return createHash("sha256")
    .update([...new Set(ids)].sort().join(","))
    .digest("hex");
}
