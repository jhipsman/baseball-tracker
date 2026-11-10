import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { emailHtml } from "./email-layout";
import { AUTH_EMAILS, billingEmail, productUpdateHtml } from "./email-templates";

const file = (rel: string) => fileURLToPath(new URL(`../../${rel}`, import.meta.url));
/** `UPDATE_EMAIL_TEMPLATES=1 npx vitest run src/lib/email-templates.test.ts` rewrites the files. */
const update = process.env.UPDATE_EMAIL_TEMPLATES === "1";

function matchesFile(rel: string, html: string) {
  const path = file(rel);
  if (update || !existsSync(path)) writeFileSync(path, html + "\n");
  expect(readFileSync(path, "utf8")).toBe(html + "\n");
}

const sampleUpdate = productUpdateHtml({
  site: "https://9dbsbl.app",
  mailingAddress: "ADD YOUR MAILING ADDRESS",
  subject: "What's new in 9D",
  intro: ["A short line on what this update is about."],
  sections: [
    { heading: "New this month", lines: ["First thing that shipped.", "Second thing."] },
    { heading: "Coming next", lines: ["What you are building now, and roughly when."] },
  ],
  button: { label: "Open 9D", href: "https://9dbsbl.app" },
});

describe("email layout", () => {
  it("escapes text and shows the 9D mark from the site", () => {
    const html = emailHtml({ site: "https://x.test/", heading: "A <b> & c", lines: ["it's"] });
    expect(html).toContain("A &lt;b&gt; &amp; c");
    expect(html).toContain('src="https://x.test/icons/icon-192.png"');
    expect(emailHtml({ heading: "h", lines: [] })).not.toContain("<img");
  });
});

describe("billing emails", () => {
  it("says when the plan renews", () => {
    const m = billingEmail("subscribed", { team: "Hawks", renewsAt: "2026-12-10T05:00:00Z" });
    expect(m.heading).toBe("Hawks is on 9D Team");
    expect(m.lines.join(" ")).toContain("December 10, 2026");
    expect(billingEmail("subscribed", { team: "Hawks" }).lines.join(" ")).not.toContain("renews");
  });
  it("tells a canceled team nothing was deleted", () => {
    expect(billingEmail("canceled", { team: "Hawks" }).lines[0]).toContain("Nothing was deleted");
  });
});

describe("product update email", () => {
  it("keeps Resend's unsubscribe link and greeting for each person", () => {
    expect(sampleUpdate).toContain('href="{{{RESEND_UNSUBSCRIBE_URL}}}"');
    expect(sampleUpdate).toContain("Hi {{{contact.first_name|there}}},");
    matchesFile("docs/email-templates/product-update.html", sampleUpdate);
  });
});

describe("login email files (pasted into Supabase)", () => {
  for (const [name, t] of Object.entries(AUTH_EMAILS)) {
    it(`${name} is up to date and keeps Supabase's placeholders`, () => {
      expect(t.html).toContain("{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=");
      matchesFile(`supabase/templates/${name}`, t.html);
    });
  }
});
