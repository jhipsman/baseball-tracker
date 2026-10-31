/** Game-day medical card helpers (shared by the family form and the coach view). */

export type Contact = { name: string; phone: string; relation: string };

export function parseContacts(raw: unknown): Contact[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 3).flatMap((x) => {
    if (!x || typeof x !== "object") return [];
    const r = x as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim().slice(0, 80) : "";
    const phone = typeof r.phone === "string" ? r.phone.trim().slice(0, 30) : "";
    const relation = typeof r.relation === "string" ? r.relation.trim().slice(0, 40) : "";
    return name || phone ? [{ name, phone, relation }] : [];
  });
}

/** A tel: link for a typed phone number ("(555) 123-4567 ext 2" → "tel:5551234567"). */
export function telHref(phone: string): string | null {
  const main = phone.split(/x|ext/i)[0];
  const digits = main.replace(/[^\d+]/g, "");
  return digits.replace(/\D/g, "").length >= 7 ? `tel:${digits}` : null;
}

/** Nothing worth flagging ("none", "n/a", "no")? */
export const isNone = (v: string | null | undefined) =>
  !v || /^(none|n\/?a|no|nope|nothing|-+)\.?$/i.test(v.trim());
