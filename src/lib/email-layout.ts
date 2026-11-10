import { BRAND } from "@/constants/brand";

/** Escapes text for HTML. Template placeholders such as {{ .TokenHash }} pass through untouched. */
export const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

export type EmailSection = { heading: string; lines: string[] };

export type EmailLayout = {
  heading: string;
  lines: string[];
  /** Extra blocks under the main text, each with its own small heading (product updates). */
  sections?: EmailSection[];
  button?: { label: string; href: string };
  /** Plain-text footer. */
  footer?: string;
  /** Footer as trusted HTML (for an unsubscribe link). Wins over `footer`. Never pass user text. */
  footerHtml?: string;
  /** Site address; the 9D mark is loaded from it. Without it the header is the wordmark alone. */
  site?: string;
  /** The grey preview line inboxes show next to the subject. */
  preheader?: string;
};

const GREEN = "#027a48";
const p = (l: string) =>
  `<p style="font-size:15px;line-height:1.5;margin:0 0 10px;color:#3f3f46">${esc(l)}</p>`;

/** One plain, phone-friendly, 9D-branded layout for every email. */
export function emailHtml(o: EmailLayout) {
  const btn = o.button
    ? `<p style="margin:28px 0 8px"><a href="${esc(o.button.href)}" style="background:${GREEN};color:#ffffff;text-decoration:none;font-weight:600;padding:14px 22px;border-radius:999px;display:inline-block">${esc(o.button.label)}</a></p>`
    : "";
  const mark = o.site
    ? `<td style="padding:0 10px 0 0"><img src="${esc(o.site.replace(/\/$/, ""))}/icons/icon-192.png" width="36" height="36" alt="" style="display:block;border:0;border-radius:9px"></td>`
    : "";
  const header = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr>${mark}<td style="font-size:24px;font-weight:800;font-style:italic;letter-spacing:-0.5px;color:${GREEN}">${esc(BRAND.name)}</td></tr></table>`;
  const sections = (o.sections ?? [])
    .map(
      (s) =>
        `<div style="border-top:1px solid #e4e4e7;margin:18px 0 0;padding:18px 0 0"><h2 style="font-size:16px;line-height:1.3;margin:0 0 8px;color:#18181b">${esc(s.heading)}</h2>${s.lines.map(p).join("")}</div>`,
    )
    .join("");
  const preheader = o.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(o.preheader)}</div>`
    : "";
  const footer =
    o.footerHtml ??
    esc(
      o.footer ??
        `${BRAND.legalName} · You get this because you're on a team in ${BRAND.name}. Choose which emails you get under Notifications.`,
    );
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#18181b">
${preheader}<div style="max-width:520px;margin:0 auto;padding:28px 20px">
${header}
<div style="background:#ffffff;border-radius:16px;padding:24px">
<h1 style="font-size:20px;line-height:1.3;margin:0 0 12px">${esc(o.heading)}</h1>
${o.lines.map(p).join("")}
${sections}
${btn}
</div>
<p style="font-size:12px;line-height:1.5;color:#71717a;margin:16px 4px">${footer}</p>
</div></body></html>`;
}
