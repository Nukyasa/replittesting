import { z } from "zod";

const date = z.string().datetime({ offset: true }).transform(v => new Date(v).toISOString()).nullable();
const owner = z.string().min(1).max(100).nullable();
export const decisionSchema = z.object({
  version: z.number().int().min(0),
  decision: z.enum(["pending", "go", "no_go"]),
  reason: z.string().trim().max(4000),
  owner_id: owner,
  internal_deadline: date,
}).strict().refine(v => v.decision === "pending" || v.reason.length > 0, "Navedite razlog odluke.");

export const requirementSchema = z.object({
  title: z.string().trim().min(1).max(1000),
  document_id: z.string().min(1).max(100).nullable(),
  source_quote: z.string().trim().max(8000),
  owner_id: owner,
  due_at: date,
  status: z.enum(["todo", "in_progress", "review", "done"]),
  proof: z.string().trim().max(8000),
  proof_document_id: z.string().min(1).max(100).nullable().optional().default(null),
  proof_valid_until: z.string().date().nullable().optional().default(null),
  version: z.number().int().min(0),
}).strict().refine(v => !v.source_quote || !!v.document_id, "Odaberite izvorni dokument za citat.")
  .refine(v => v.status !== "done" || (!!v.proof && !!v.owner_id), "Za potvrđenu stavku navedite odgovornu osobu i dokaz provjere.");

export const normalizeQuote = (value: string) => value.replace(/\s+/g, " ").trim();
export function quoteExists(text: string | null, quote: string) {
  return !quote || normalizeQuote(text || "").includes(normalizeQuote(quote));
}
