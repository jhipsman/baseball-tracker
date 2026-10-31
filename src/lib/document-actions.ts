"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireActiveOrg } from "@/lib/org";
import { dispatchPush } from "@/lib/push";
import { BRAND } from "@/constants/brand";
import { addSignaturePage, sha256 } from "@/lib/sign-pdf";
import {
  CREDENTIALS,
  DOC_KINDS,
  docPath,
  type CredentialKind,
  type DocKind,
} from "@/lib/documents";

type R = { error?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const BUCKET = "team-docs";

function refresh() {
  revalidatePath("/documents", "layout");
  revalidatePath("/player", "layout");
  revalidatePath("/parent", "layout");
}

async function staff() {
  const ctx = await requireActiveOrg();
  if (!ctx.isStaff) return { error: "Only coaches can manage documents." } as const;
  return ctx;
}

/** After the PDF is uploaded to its spot, record the document (and optionally tell the team). */
export async function createDocument(input: {
  id: string;
  title: string;
  description: string;
  kind: DocKind;
  audience: "families" | "staff";
  groupId: string | null;
  dueDate: string | null;
  hasFile: boolean;
  notify: boolean;
}): Promise<R> {
  const ctx = await staff();
  if ("error" in ctx) return { error: ctx.error };
  const title = String(input.title ?? "").trim();
  if (!UUID.test(input.id)) return { error: "Something went wrong. Refresh and try again." };
  if (!title || title.length > 120) return { error: "Give the document a name." };
  if (!DOC_KINDS.some((k) => k.key === input.kind))
    return { error: "Choose what people need to do." };
  if (!["families", "staff"].includes(input.audience)) return { error: "Choose who it's for." };
  if (input.groupId && !UUID.test(input.groupId)) return { error: "Choose a group." };
  if (input.dueDate && !DATE.test(input.dueDate)) return { error: "Check the due date." };
  if (!input.hasFile && input.kind !== "upload") return { error: "Add the PDF." };

  let filePath: string | null = null,
    fileSha: string | null = null;
  if (input.hasFile) {
    filePath = docPath.form(ctx.org.id, input.id);
    const { data: file, error } = await ctx.supabase.storage.from(BUCKET).download(filePath);
    if (error || !file) return { error: "The PDF didn't upload. Try again." };
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") {
      await ctx.supabase.storage.from(BUCKET).remove([filePath]);
      return { error: "That file isn't a PDF." };
    }
    fileSha = sha256(bytes);
  }
  const { error } = await ctx.supabase.from("team_documents").insert({
    id: input.id,
    org_id: ctx.org.id,
    title,
    description:
      String(input.description ?? "")
        .trim()
        .slice(0, 1000) || null,
    kind: input.kind,
    audience: input.audience,
    group_id: input.audience === "families" ? input.groupId : null,
    file_path: filePath,
    file_sha256: fileSha,
    due_date: input.dueDate || null,
    created_by: ctx.user.id,
  });
  if (error) return { error: "Couldn't save the document. Try again." };
  if (input.notify && input.kind !== "read") {
    await ctx.supabase.rpc("notify_document", { p_doc: input.id, p_missing_only: false });
    after(() => dispatchPush());
  }
  refresh();
  return {};
}

export async function setDocumentArchived(id: string, archived: boolean): Promise<R> {
  const ctx = await staff();
  if ("error" in ctx) return { error: ctx.error };
  const { error } = await ctx.supabase
    .from("team_documents")
    .update({ archived })
    .eq("id", id)
    .eq("org_id", ctx.org.id);
  if (error) return { error: "Couldn't save. Try again." };
  refresh();
  return {};
}

export async function remindDocument(id: string): Promise<R & { sent?: number }> {
  const ctx = await staff();
  if ("error" in ctx) return { error: ctx.error };
  const { data, error } = await ctx.supabase.rpc("notify_document", {
    p_doc: id,
    p_missing_only: true,
  });
  if (error)
    return {
      error: error.message.includes("already went out")
        ? "A reminder already went out today."
        : "Couldn't send reminders. Try again.",
    };
  after(() => dispatchPush());
  return { sent: data ?? 0 };
}

async function loadForCompletion(docId: string, subjectId: string) {
  const ctx = await requireActiveOrg();
  if (!UUID.test(docId) || !UUID.test(subjectId)) return { error: "Form not found." } as const;
  const { data: doc } = await ctx.supabase
    .from("team_documents")
    .select("*")
    .eq("id", docId)
    .maybeSingle();
  if (!doc || doc.archived) return { error: "This form is no longer available." } as const;
  return { ...ctx, doc };
}

function saveError(code: string | undefined) {
  return code === "23505"
    ? "This form is already done for this player."
    : "You can't complete this form for that person.";
}

export async function acknowledgeDocument(docId: string, subjectId: string): Promise<R> {
  const c = await loadForCompletion(docId, subjectId);
  if ("error" in c) return { error: c.error };
  if (c.doc.kind !== "acknowledge") return { error: "This form needs something else." };
  const { error } = await c.supabase.from("document_responses").insert({
    org_id: c.doc.org_id,
    document_id: docId,
    subject_id: subjectId,
    completed_by: c.user.id,
    kind: "acknowledged",
  });
  if (error) return { error: saveError(error.code) };
  refresh();
  return {};
}

/**
 * Sign: the server fetches the exact form, adds a signature page with the
 * signer's name (and drawing), when, from where and the form's fingerprint,
 * and stores that as the signed copy.
 */
export async function signDocument(input: {
  docId: string;
  subjectId: string;
  name: string;
  drawing: string | null;
  consent: boolean;
}): Promise<R> {
  const c = await loadForCompletion(input.docId, input.subjectId);
  if ("error" in c) return { error: c.error };
  if (c.doc.kind !== "sign" || !c.doc.file_path) return { error: "This form isn't for signing." };
  if (!input.consent) return { error: "Check the box to sign electronically." };
  const name = String(input.name ?? "").trim();
  if (name.length < 2 || name.length > 120) return { error: "Type your full name to sign." };
  let drawing: Uint8Array | null = null;
  if (input.drawing) {
    const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(input.drawing);
    if (!m || m[1].length > 400_000) return { error: "The signature drawing didn't come through." };
    drawing = new Uint8Array(Buffer.from(m[1], "base64"));
  }
  const { data: file, error: dlError } = await c.supabase.storage
    .from(BUCKET)
    .download(c.doc.file_path);
  if (dlError || !file) return { error: "Couldn't open the form. Try again." };
  const original = new Uint8Array(await file.arrayBuffer());
  const docSha = sha256(original);
  if (c.doc.file_sha256 && docSha !== c.doc.file_sha256)
    return { error: "This form changed. Refresh and read it again before signing." };

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  const agent = (h.get("user-agent") ?? "").slice(0, 400) || null;
  const [{ data: team }, { data: subject }] = await Promise.all([
    c.supabase.from("organizations").select("name").eq("id", c.doc.org_id).single(),
    c.supabase.from("profiles").select("full_name").eq("id", input.subjectId).maybeSingle(),
  ]);
  const signedAt = new Date();
  let signed: Uint8Array;
  try {
    signed = await addSignaturePage(original, {
      title: c.doc.title,
      team: team?.name ?? "",
      signer: name,
      forPlayer: input.subjectId === c.user.id ? null : (subject?.full_name ?? "the player"),
      signedAt,
      ip,
      docSha256: docSha,
      drawing,
      appName: BRAND.name,
    });
  } catch {
    return { error: "This PDF can't be signed here. Ask your coach for another copy." };
  }
  const path = docPath.response(c.doc.org_id, input.subjectId, input.docId, "pdf");
  const { error: upError } = await c.supabase.storage
    .from(BUCKET)
    .upload(path, signed, { contentType: "application/pdf" });
  if (upError) return { error: "Couldn't save the signed copy. Try again." };
  const { error } = await c.supabase.from("document_responses").insert({
    org_id: c.doc.org_id,
    document_id: input.docId,
    subject_id: input.subjectId,
    completed_by: c.user.id,
    kind: "signed",
    signed_name: name,
    file_path: path,
    doc_sha256: docSha,
    consent_at: signedAt.toISOString(),
    signer_ip: ip,
    signer_agent: agent,
  });
  if (error) {
    await c.supabase.storage.from(BUCKET).remove([path]);
    return { error: saveError(error.code) };
  }
  refresh();
  return {};
}

/** A family uploaded their file to its spot; record it. */
export async function recordUpload(docId: string, subjectId: string, path: string): Promise<R> {
  const c = await loadForCompletion(docId, subjectId);
  if ("error" in c) return { error: c.error };
  if (c.doc.kind !== "upload") return { error: "This form needs something else." };
  if (!path.startsWith(`${c.doc.org_id}/responses/${subjectId}/${docId}-`))
    return { error: "Upload didn't match this form. Try again." };
  const { error } = await c.supabase.from("document_responses").insert({
    org_id: c.doc.org_id,
    document_id: docId,
    subject_id: subjectId,
    completed_by: c.user.id,
    kind: "uploaded",
    file_path: path,
  });
  if (error) {
    await c.supabase.storage.from(BUCKET).remove([path]);
    return { error: saveError(error.code) };
  }
  refresh();
  return {};
}

/** A short-lived link to open a file the person is allowed to see. */
export async function openFile(path: string): Promise<{ url?: string; error?: string }> {
  const { supabase } = await requireActiveOrg();
  if (typeof path !== "string" || path.length > 300) return { error: "File not found." };
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
  if (error || !data) return { error: "You can't open that file." };
  return { url: data.signedUrl };
}

export async function addCredential(input: {
  kind: CredentialKind;
  label: string;
  path: string;
  issuedOn: string | null;
  expiresOn: string | null;
}): Promise<R> {
  const ctx = await staff();
  if ("error" in ctx) return { error: ctx.error };
  if (!CREDENTIALS.some((k) => k.key === input.kind)) return { error: "Choose what it is." };
  if (!input.path.startsWith(`${ctx.org.id}/credentials/${ctx.user.id}/`))
    return { error: "Upload didn't come through. Try again." };
  if (
    (input.issuedOn && !DATE.test(input.issuedOn)) ||
    (input.expiresOn && !DATE.test(input.expiresOn))
  )
    return { error: "Check the dates." };
  const { error } = await ctx.supabase.from("staff_credentials").insert({
    org_id: ctx.org.id,
    profile_id: ctx.user.id,
    kind: input.kind,
    label:
      String(input.label ?? "")
        .trim()
        .slice(0, 120) || null,
    file_path: input.path,
    issued_on: input.issuedOn || null,
    expires_on: input.expiresOn || null,
  });
  if (error) {
    await ctx.supabase.storage.from(BUCKET).remove([input.path]);
    return { error: "Couldn't save it. Check the dates and try again." };
  }
  refresh();
  return {};
}

export async function removeCredential(id: string): Promise<R> {
  const { supabase } = await requireActiveOrg();
  const { data } = await supabase
    .from("staff_credentials")
    .select("file_path")
    .eq("id", id)
    .maybeSingle();
  if (!data) return { error: "Not found." };
  const { error } = await supabase.from("staff_credentials").delete().eq("id", id);
  if (error) return { error: "Couldn't remove it." };
  await supabase.storage.from(BUCKET).remove([data.file_path]);
  refresh();
  return {};
}
