import { Router, type Request, type Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { createHash } from "node:crypto";
import { z, ZodError } from "zod";
import { assessReadiness } from "../services/submissionReadiness";
import { getTenderHistory, authorityIdentity, queueHistory, historyRunning } from "../services/awardHistory";
import { authMiddleware } from "../middlewares/auth";
import { nanoid } from "../lib/nanoid";
import { collectDocumentEvidence } from "../services/tenderEvidence";
import { decisionSchema, requirementSchema, quoteExists, normalizeQuote } from "../services/workspaceRules";

export const workspaceRouter = Router();
workspaceRouter.use(authMiddleware);
const rows = async (statement: any, executor = db): Promise<any[]> => (await executor.execute(statement)).rows;
class WorkError extends Error { constructor(public status: number, message: string) { super(message); } }
const route = (fn: (req: Request, res: Response) => Promise<unknown>) => async (req: Request, res: Response, next: any) => {
  try { await fn(req, res); return; } catch (error) {
    if (error instanceof ZodError) return res.status(400).json({ error: error.issues.map(i => i.message).join(" ") });
    if (error instanceof WorkError) return res.status(error.status).json({ error: error.message });
    return next(error);
  }
};
async function tenderExists(id: string) {
  if (!(await rows(sql`SELECT id FROM tenders WHERE id=${id}`)).length) throw new WorkError(404, "Tender nije pronađen.");
}
async function ownerExists(id: string | null) {
  if (id && !(await rows(sql`SELECT id FROM users WHERE id=${id}`)).length) throw new WorkError(400, "Odgovorna osoba nije pronađena.");
}
async function event(tx: any, id: string, actor: string, message: string, details: unknown) {
  await tx.execute(sql`INSERT INTO tender_work_events (id,tender_id,actor_id,message,details)
    VALUES (${nanoid()},${id},${actor},${message},${JSON.stringify(details)}::jsonb)`);
}
const conflict = () => new WorkError(409, "Drugi član tima je izmijenio zapis. Osvježite podatke pa ponovite izmjenu.");

workspaceRouter.get("/day", route(async (req, res) => {
  const id = req.user!.id;
  const taskRows = await rows(sql`SELECT r.*,t.title AS tender_title,t.deadline AS tender_deadline,w.decision,d.parsed_text
    FROM tender_requirements r JOIN tenders t ON t.id=r.tender_id
    LEFT JOIN tender_workspaces w ON w.tender_id=r.tender_id
    LEFT JOIN documents d ON d.id=r.document_id
    WHERE r.owner_id=${id} AND COALESCE(w.decision,'pending')<>'no_go'
    ORDER BY r.due_at ASC NULLS LAST,r.updated_at DESC`);
  const tasks = taskRows.map(({ parsed_text, ...task }) => ({ ...task, source_changed: !!task.source_quote && (!task.document_id || !quoteExists(parsed_text, task.source_quote)) }))
    .filter(task => task.status !== 'done' || task.source_changed);
  const decisions = await rows(sql`SELECT w.*,t.title,t.deadline FROM tender_workspaces w
    JOIN tenders t ON t.id=w.tender_id WHERE w.owner_id=${id} AND w.decision<>'no_go'
    ORDER BY w.internal_deadline ASC NULLS LAST`);
  const changes = await rows(sql`SELECT c.*,t.title FROM tender_changes c JOIN tenders t ON t.id=c.tender_id
    WHERE c.changed_at >= now()-interval '7 days' AND (
      EXISTS(SELECT 1 FROM user_tenders u WHERE u.tender_id=t.id AND u.user_id=${id}) OR
      EXISTS(SELECT 1 FROM tender_workspaces w WHERE w.tender_id=t.id AND w.owner_id=${id}) OR
      EXISTS(SELECT 1 FROM tender_requirements r WHERE r.tender_id=t.id AND r.owner_id=${id}))
    ORDER BY c.changed_at DESC LIMIT 30`);
  res.json({ tasks, decisions, changes });
}));

workspaceRouter.get("/:id", route(async (req, res) => {
  const id = String(req.params.id); await tenderExists(id);
  const [workspace, tasks, users, documents, events] = await Promise.all([
    rows(sql`SELECT * FROM tender_workspaces WHERE tender_id=${id}`),
    rows(sql`SELECT r.*,d.name AS document_name,d.parsed_text FROM tender_requirements r
      LEFT JOIN documents d ON d.id=r.document_id WHERE r.tender_id=${id} ORDER BY r.id`),
    rows(sql`SELECT id,name FROM users ORDER BY name`),
    rows(sql`SELECT id,name FROM documents WHERE tender_id=${id} AND file_type<>'EJN_PORTAL_LINK' AND superseded_by IS NULL ORDER BY name`),
    rows(sql`SELECT e.*,u.name AS actor_name FROM tender_work_events e LEFT JOIN users u ON u.id=e.actor_id
      WHERE e.tender_id=${id} ORDER BY e.created_at DESC LIMIT 50`),
  ]);
  res.json({ workspace: workspace[0] || { tender_id: id, decision: "pending", reason: "", owner_id: null, internal_deadline: null, version: 0 },
    tasks: tasks.map(({ parsed_text, ...task }) => ({ ...task, source_changed: !!task.source_quote && (!task.document_id || !quoteExists(parsed_text, task.source_quote)) })), users, documents, events });
}));

async function readinessData(id: string, executor = db) {
  const [tender] = await rows(sql`SELECT * FROM tenders WHERE id=${id}`, executor);
  if (!tender) throw new WorkError(404, 'Tender nije pronađen.');
  const [workspace] = await rows(sql`SELECT * FROM tender_workspaces WHERE tender_id=${id}`, executor);
  const tasks = await rows(sql`SELECT * FROM tender_requirements WHERE tender_id=${id} ORDER BY id`, executor);
  const docs = await rows(sql`SELECT * FROM documents WHERE tender_id=${id}`, executor);
  return assessReadiness(workspace, tasks, docs, tender);
}
workspaceRouter.get('/:id/readiness', route(async (req,res) => {
  const id = String(req.params.id);
  const result = await readinessData(id);
  const [review] = await rows(sql`SELECT r.*,u.name AS reviewer_name FROM tender_final_reviews r LEFT JOIN users u ON u.id=r.reviewer_id
    WHERE r.tender_id=${id} ORDER BY r.reviewed_at DESC LIMIT 1`);
  res.json({ ...result, review: review ? { ...review, current: review.fingerprint === result.fingerprint && result.ready } : null });
}));
workspaceRouter.post('/:id/readiness/review', route(async (req,res) => {
  const id = String(req.params.id);
  const value = z.object({ fingerprint: z.string().length(64), note: z.string().trim().min(1).max(4000), completeDocumentationReviewed: z.literal(true) }).strict().parse(req.body);
  await db.transaction(async (tx: any) => {
    const result = await readinessData(id, tx);
    if (result.fingerprint !== value.fingerprint) throw conflict();
    if (!result.ready) throw new WorkError(422, result.blockers.join(' '));
    await tx.execute(sql`INSERT INTO tender_final_reviews(id,tender_id,reviewer_id,fingerprint,note) VALUES(${nanoid()},${id},${req.user!.id},${result.fingerprint},${value.note})`);
    await event(tx,id,req.user!.id,'Završna interna provjera evidentirana',{ note: value.note, fingerprint: result.fingerprint, completeDocumentationReviewed: true });
  });
  res.json({ saved: true });
}));
workspaceRouter.get('/:id/history', route(async (req,res) => {
  const [tender] = await rows(sql`SELECT * FROM tenders WHERE id=${String(req.params.id)}`);
  if (!tender) throw new WorkError(404,'Tender nije pronađen.');
  res.json(await getTenderHistory(tender));
}));
workspaceRouter.post('/:id/history/sync', route(async (req,res) => {
  const [tender] = await rows(sql`SELECT * FROM tenders WHERE id=${String(req.params.id)}`);
  if (!tender) throw new WorkError(404,'Tender nije pronađen.');
  const authority = authorityIdentity(tender);
  if (!authority) throw new WorkError(422,'Nije potvrđen EJN identifikator naručioca.');
  if (historyRunning(authority)) return res.status(202).json({ status: 'running' });
  if (!queueHistory(authority,tender)) throw new WorkError(409,'Dva preuzimanja historije su u toku. Pokušajte ponovo nakon njihovog završetka.');
  return res.status(202).json({ status: 'running' });
}));

workspaceRouter.put("/:id/decision", route(async (req, res) => {
  const id = String(req.params.id); const value = decisionSchema.parse(req.body);
  await tenderExists(id); await ownerExists(value.owner_id);
  await db.transaction(async (tx: any) => {
    const saved = value.version === 0
      ? await rows(sql`INSERT INTO tender_workspaces(tender_id,decision,reason,owner_id,internal_deadline,updated_by)
          VALUES(${id},${value.decision},${value.reason},${value.owner_id},${value.internal_deadline},${req.user!.id})
          ON CONFLICT DO NOTHING RETURNING tender_id`, tx)
      : await rows(sql`UPDATE tender_workspaces SET decision=${value.decision},reason=${value.reason},owner_id=${value.owner_id},
          internal_deadline=${value.internal_deadline},updated_by=${req.user!.id},updated_at=now(),version=version+1
          WHERE tender_id=${id} AND version=${value.version} RETURNING tender_id`, tx);
    if (!saved.length) throw conflict();
    await event(tx, id, req.user!.id, "Odluka i plan ponude sačuvani", value);
  });
  res.json({ saved: true });
}));

workspaceRouter.post("/:id/requirements/import", route(async (req, res) => {
  const id = String(req.params.id); await tenderExists(id);
  const documents = await rows(sql`SELECT id,name,parsed_text AS "parsedText",text_pages AS "textPages",file_type AS "fileType" FROM documents WHERE tender_id=${id} AND superseded_by IS NULL`);
  const evidence = collectDocumentEvidence(documents as any);
  const kinds: Record<string,string> = { requirement: "Provjeriti uslov", document: "Pripremiti dokument", declaration: "Provjeriti izjavu", deadline: "Provjeriti rok", guarantee: "Provjeriti garanciju", criterion: "Provjeriti kriterij" };
  const count = await db.transaction(async (tx: any) => {
    let added = 0;
    for (const item of evidence) {
      const key = createHash("sha256").update(item.documentId + "|" + normalizeQuote(item.quote)).digest("hex");
      if (item.pageNumber) await tx.execute(sql`UPDATE tender_requirements SET source_page=COALESCE(source_page,${item.pageNumber}) WHERE tender_id=${id} AND source_key=${key}`);
      const saved = await rows(sql`INSERT INTO tender_requirements(id,tender_id,title,document_id,source_quote,source_page,source_key,updated_by)
        VALUES(${nanoid()},${id},${kinds[item.kind]},${item.documentId},${item.quote},${item.pageNumber || null},${key},${req.user!.id})
        ON CONFLICT(tender_id,source_key) DO NOTHING RETURNING id`, tx);
      added += saved.length;
    }
    if (added) await event(tx, id, req.user!.id, `Dodano ${added} stavki iz dokumentacije`, { count: added });
    return added;
  });
  res.json({ added: count, found: evidence.length });
}));

async function saveRequirement(req: Request, res: Response) {
  const id = String(req.params.id), taskId = req.params.taskId ? String(req.params.taskId) : null;
  const value = requirementSchema.parse(req.body); await tenderExists(id); await ownerExists(value.owner_id);
  await db.transaction(async (tx: any) => {
    if (value.proof_document_id) {
      const [proof] = await rows(sql`SELECT local_path,file_type FROM documents WHERE id=${value.proof_document_id} AND tender_id=${id}`,tx);
      if (!proof?.local_path || /link|html|url/i.test(proof.file_type)) throw new WorkError(400,'Dokaz mora biti učitana datoteka ovog tendera.');
    }
    if (value.document_id) {
      const [doc] = await rows(sql`SELECT parsed_text FROM documents WHERE id=${value.document_id} AND tender_id=${id} FOR SHARE`, tx);
      if (!doc) throw new WorkError(400, "Dokument ne pripada ovom tenderu.");
      if (!quoteExists(doc.parsed_text, value.source_quote)) throw new WorkError(400, "Citat nije pronađen u odabranom dokumentu. Provjerite izvornik.");
    }
    const saved = taskId
      ? await rows(sql`UPDATE tender_requirements SET title=${value.title},document_id=${value.document_id},source_quote=${value.source_quote},
          owner_id=${value.owner_id},due_at=${value.due_at},status=${value.status},proof=${value.proof},proof_document_id=${value.proof_document_id},proof_valid_until=${value.proof_valid_until},version=version+1,updated_at=now(),updated_by=${req.user!.id}
          WHERE id=${taskId} AND tender_id=${id} AND version=${value.version} RETURNING id`, tx)
      : await rows(sql`INSERT INTO tender_requirements(id,tender_id,title,document_id,source_quote,owner_id,due_at,status,proof,proof_document_id,proof_valid_until,updated_by)
          VALUES(${nanoid()},${id},${value.title},${value.document_id},${value.source_quote},${value.owner_id},${value.due_at},${value.status},${value.proof},${value.proof_document_id},${value.proof_valid_until},${req.user!.id}) RETURNING id`, tx);
    if (!saved.length) throw conflict();
    await event(tx, id, req.user!.id, taskId ? "Stavka ažurirana" : "Stavka dodana", { ...value, id: saved[0].id });
  });
  res.status(taskId ? 200 : 201).json({ saved: true });
}
workspaceRouter.post("/:id/requirements", route(saveRequirement));
workspaceRouter.put("/:id/requirements/:taskId", route(saveRequirement));
