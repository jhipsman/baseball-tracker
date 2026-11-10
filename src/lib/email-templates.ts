import { BRAND } from "@/constants/brand";
import { emailHtml, esc, type EmailSection } from "@/lib/email-layout";

// ---------------------------------------------------------------------------
// Billing (sent to a team's admins by the 9D subscription webhook)
// ---------------------------------------------------------------------------

export type BillingEmailKind = "subscribed" | "canceled";

const longDate = (iso: string | null | undefined) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : null;
};

/** Wording for a billing email. Receipts and failed-card notices come from Stripe itself. */
export function billingEmail(
  kind: BillingEmailKind,
  o: { team: string; renewsAt?: string | null },
) {
  const n = BRAND.name;
  if (kind === "subscribed") {
    const renews = longDate(o.renewsAt);
    return {
      subject: `You're subscribed to ${n}`,
      heading: `${o.team} is on ${n} Team`,
      lines: [
        `Thanks for subscribing. Everything in ${n} stays on for your coaches, players and parents.`,
        renews ? `Your plan renews on ${renews}.` : "",
        "You can change your card, switch between monthly and yearly, or cancel any time under Settings. Your receipts come by email from Stripe, our payment processor.",
      ].filter(Boolean),
      button: { label: "Manage billing", path: "/settings" },
    };
  }
  return {
    subject: `Your ${n} subscription has ended`,
    heading: `${o.team}'s subscription has ended`,
    lines: [
      "Coach pages are now view only. Nothing was deleted.",
      "Subscribe again any time under Settings and your team picks up where it left off.",
    ],
    button: { label: "Subscribe again", path: "/settings" },
  };
}

// ---------------------------------------------------------------------------
// Product updates (release notes, roadmap). Sent as a Resend Broadcast, which
// fills in the greeting and the unsubscribe link for each person.
// ---------------------------------------------------------------------------

export type ProductUpdate = {
  subject: string;
  /** One or two sentences on what this update is about. */
  intro: string[];
  /** What's new, what's next, and so on. */
  sections: EmailSection[];
  button?: { label: string; href: string };
  site: string;
  /** Postal address. US law requires one on announcement emails. */
  mailingAddress: string;
};

export function productUpdateHtml(u: ProductUpdate) {
  return emailHtml({
    site: u.site,
    preheader: u.intro[0],
    heading: u.subject,
    lines: ["Hi {{{contact.first_name|there}}},", ...u.intro],
    sections: u.sections,
    button: u.button,
    footerHtml: `${esc(BRAND.legalName)} · ${esc(u.mailingAddress)}<br>You get product news because you run a team on ${esc(BRAND.name)}. <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#71717a">Unsubscribe</a>`,
  });
}

// ---------------------------------------------------------------------------
// Login emails. Supabase sends these, so they live as files in
// supabase/templates and use Supabase's {{ .SiteURL }} / {{ .TokenHash }}.
// ---------------------------------------------------------------------------

const SITE = "{{ .SiteURL }}";
const quiet = `${BRAND.legalName} · Didn't ask for this? You can ignore this email.`;

export const AUTH_EMAILS = {
  "confirm.html": {
    subject: `Confirm your email for ${BRAND.name}`,
    html: emailHtml({
      site: SITE,
      heading: "Confirm your email",
      lines: [`Welcome to ${BRAND.name}. Tap below to confirm your email and get started.`],
      button: {
        label: "Confirm my email",
        href: `${SITE}/auth/confirm?token_hash={{ .TokenHash }}&type=email`,
      },
      footer: quiet,
    }),
  },
  "recovery.html": {
    subject: `Reset your ${BRAND.name} password`,
    html: emailHtml({
      site: SITE,
      heading: "Reset your password",
      lines: [`Tap below to choose a new password for ${BRAND.name}. The link works once.`],
      button: {
        label: "Choose a new password",
        href: `${SITE}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`,
      },
      footer: quiet,
    }),
  },
  "email_change.html": {
    subject: `Confirm your new email for ${BRAND.name}`,
    html: emailHtml({
      site: SITE,
      heading: "Confirm your new email",
      lines: [`Tap below to start signing in to ${BRAND.name} with {{ .NewEmail }}.`],
      button: {
        label: "Confirm new email",
        href: `${SITE}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change`,
      },
      footer: quiet,
    }),
  },
} as const;
