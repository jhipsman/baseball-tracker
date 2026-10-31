import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { PDFDocument } from "pdf-lib";
import { addSignaturePage, sha256 } from "./sign-pdf";
import { credentialStatus } from "./documents";

describe("addSignaturePage", () => {
  it("keeps the form and adds one signature page with the record", async () => {
    const form = await PDFDocument.create();
    form.addPage();
    form.addPage();
    const bytes = await form.save();
    const out = await addSignaturePage(bytes, {
      title: "Medical release · 2027",
      team: "Rays",
      signer: "Pam Parent",
      forPlayer: "Ty Parent",
      signedAt: new Date("2026-11-01T15:00:00Z"),
      ip: "203.0.113.9",
      docSha256: sha256(bytes),
      drawing: null,
      appName: "9D",
    });
    const signed = await PDFDocument.load(out);
    expect(signed.getPageCount()).toBe(3);
    expect(signed.getSubject()).toBe("Signed: Medical release · 2027");
    expect(signed.getKeywords()).toContain(`sha256:${sha256(bytes)}`);
  });
});

describe("credentialStatus", () => {
  const c = (expires_on: string | null) => ({ expires_on, created_at: "2026-01-01" });
  it("reads the newest certificate", () => {
    expect(credentialStatus([], "2026-11-01").status).toBe("missing");
    expect(credentialStatus([c("2026-10-01")], "2026-11-01").status).toBe("expired");
    expect(credentialStatus([c("2026-11-20")], "2026-11-01").status).toBe("expiring");
    expect(credentialStatus([c("2026-10-01"), c("2027-06-01")], "2026-11-01")).toEqual({
      status: "current",
      expires: "2027-06-01",
    });
    expect(credentialStatus([c(null)], "2026-11-01").status).toBe("current");
  });
});
