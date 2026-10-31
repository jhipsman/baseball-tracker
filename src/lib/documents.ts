/** Labels and status rules for Documents (shared by coach and family pages). */

export type DocKind = "read" | "acknowledge" | "sign" | "upload";

export const DOC_KINDS: { key: DocKind; label: string; action: string; hint: string }[] = [
  { key: "sign", label: "Sign", action: "Sign", hint: "Families read and sign it on their phone." },
  {
    key: "acknowledge",
    label: "Read and confirm",
    action: "Read and confirm",
    hint: "They tap “I've read this.” Good for rules and codes of conduct.",
  },
  {
    key: "upload",
    label: "Upload something back",
    action: "Upload",
    hint: "A physical, birth certificate or insurance card. A form to fill is optional.",
  },
  {
    key: "read",
    label: "Just read",
    action: "Read",
    hint: "Nothing to do; it's there when they need it.",
  },
];
export const DOC_KIND = Object.fromEntries(DOC_KINDS.map((k) => [k.key, k])) as Record<
  DocKind,
  (typeof DOC_KINDS)[number]
>;

export type CredentialKind =
  "background_check" | "safesport" | "concussion" | "first_aid" | "other";
export const CREDENTIALS: { key: CredentialKind; label: string }[] = [
  { key: "background_check", label: "Background check" },
  { key: "safesport", label: "SafeSport / abuse prevention" },
  { key: "concussion", label: "Concussion training" },
  { key: "first_aid", label: "CPR / first aid" },
  { key: "other", label: "Other" },
];

export type CredentialStatus = "current" | "expiring" | "expired" | "missing";

/** Current, expiring within 30 days, expired, or none on file. Newest certificate wins. */
export function credentialStatus(
  certs: { expires_on: string | null; created_at: string }[],
  today: string,
): { status: CredentialStatus; expires: string | null } {
  if (!certs.length) return { status: "missing", expires: null };
  const best = [...certs].sort((a, b) =>
    (b.expires_on ?? "9999-12-31").localeCompare(a.expires_on ?? "9999-12-31"),
  )[0];
  if (!best.expires_on) return { status: "current", expires: null };
  const soon = new Date(`${today}T12:00:00Z`);
  soon.setUTCDate(soon.getUTCDate() + 30);
  const limit = soon.toISOString().slice(0, 10);
  return {
    status: best.expires_on < today ? "expired" : best.expires_on <= limit ? "expiring" : "current",
    expires: best.expires_on,
  };
}

/** Does this document still need something from the person? */
export const needsAction = (kind: DocKind) => kind !== "read";

/** Storage paths (the bucket's policies key off these). */
export const docPath = {
  form: (org: string, doc: string) => `${org}/documents/${doc}.pdf`,
  response: (org: string, subject: string, doc: string, ext: string) =>
    `${org}/responses/${subject}/${doc}-${Date.now().toString(36)}.${ext}`,
  credential: (org: string, who: string, ext: string) =>
    `${org}/credentials/${who}/${Date.now().toString(36)}.${ext}`,
  /** Doctor's notes and clearances (staff, the player and their parents). */
  health: (org: string, player: string, ext: string) =>
    `${org}/health/${player}/${Date.now().toString(36)}.${ext}`,
};

export const UPLOAD_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/webp",
];
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const extFor = (type: string, name: string) =>
  type === "application/pdf"
    ? "pdf"
    : type === "image/png"
      ? "png"
      : type === "image/webp"
        ? "webp"
        : type === "image/heic"
          ? "heic"
          : /\.(jpe?g)$/i.test(name) || type === "image/jpeg"
            ? "jpg"
            : "bin";
