import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createHash } from "node:crypto";

export const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

export type SignatureInfo = {
  title: string;
  team: string;
  signer: string;
  /** Who the signature is for, when a parent signs for a player. */
  forPlayer: string | null;
  signedAt: Date;
  ip: string | null;
  docSha256: string;
  /** PNG of the drawn signature, if they drew one. */
  drawing: Uint8Array | null;
  appName: string;
};

/**
 * The original pages, untouched, plus a signature page at the end recording
 * who signed, for whom, when, from where, and the fingerprint of the exact
 * form they saw.
 */
export async function addSignaturePage(original: Uint8Array, s: SignatureInfo) {
  const pdf = await PDFDocument.load(original, { ignoreEncryption: true });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const page = pdf.addPage([612, 792]);
  const ink = rgb(0.1, 0.1, 0.12),
    soft = rgb(0.42, 0.42, 0.46),
    green = rgb(0.01, 0.6, 0.33);
  // Keep to characters the standard fonts can draw.
  const safe = (t: string) => t.replace(/[^\x20-\x7E -ÿ]/g, "?");
  let y = 720;
  const line = (text: string, size = 11, f = font, color = ink) => {
    page.drawText(safe(text), { x: 60, y, size, font: f, color, maxWidth: 492 });
    y -= size + 10;
  };
  page.drawRectangle({ x: 60, y: 742, width: 40, height: 4, color: green });
  line("Signature page", 20, bold);
  y -= 6;
  line(s.title, 13, bold);
  line(s.team, 11, font, soft);
  y -= 16;
  line("Signed by", 10, font, soft);
  line(s.signer, 14, bold);
  if (s.forPlayer) line(`Parent or guardian, for ${s.forPlayer}`, 11);
  y -= 6;
  if (s.drawing) {
    const png = await pdf.embedPng(s.drawing);
    const w = Math.min(260, png.width),
      h = (png.height / png.width) * w;
    page.drawImage(png, { x: 60, y: y - h + 10, width: w, height: h });
    y -= h + 6;
  } else {
    line(s.signer, 26, italic);
  }
  page.drawLine({ start: { x: 60, y }, end: { x: 330, y }, thickness: 0.8, color: soft });
  y -= 30;
  line(`Signed electronically ${s.signedAt.toUTCString()}`, 10, font, soft);
  if (s.ip) line(`From ${s.ip}`, 10, font, soft);
  line(`Form fingerprint (SHA-256): ${s.docSha256}`, 8, font, soft);
  y -= 8;
  line(
    `The signer agreed to sign electronically and that this signature has the same effect as signing on paper. Recorded by ${s.appName}.`,
    9,
    font,
    soft,
  );
  pdf.setSubject(`Signed: ${safe(s.title)}`);
  pdf.setKeywords([`sha256:${s.docSha256}`, `signer:${safe(s.signer)}`]);
  pdf.setModificationDate(s.signedAt);
  return pdf.save();
}
