import { createHash } from 'node:crypto';
import { quoteExists } from './workspaceRules';

type Row = Record<string, any>;
export function assessReadiness(workspace: Row | undefined, tasks: Row[], docs: Row[], tender: Row, now = new Date()) {
  const blockers: string[] = [];
  if (workspace?.decision !== 'go') blockers.push('Odluka o učešću nije „Idemo“.');
  if (!workspace?.owner_id) blockers.push('Nije dodijeljena odgovorna osoba za ponudu.');
  if (!tasks.length) blockers.push('Kontrolna lista je prazna.');
  if (!docs.some(d => d.local_path && !/link|html|url/i.test(d.file_type))) blockers.push('Nema preuzetih ili učitanih dokumenata.');
  if (tender.deadline && new Date(tender.deadline).getTime() <= now.getTime()) blockers.push('Rok za predaju je prošao.');
  const coverageThrough = Math.max(now.getTime(), tender.deadline ? new Date(tender.deadline).getTime() : 0);
  const assessed = tasks.map(task => {
    const issues: string[] = [];
    const source = docs.find(d => d.id === task.document_id);
    const proof = docs.find(d => d.id === task.proof_document_id);
    if (task.status !== 'done') issues.push('Stavka nije provjerena');
    if (!task.owner_id) issues.push('Nema odgovorne osobe');
    if (!task.proof?.trim()) issues.push('Nema bilješke o provjeri');
    if (task.source_quote && (!source || !quoteExists(source.parsed_text, task.source_quote))) issues.push('Izvorni citat zahtijeva ponovnu provjeru');
    if (task.document_id && (!proof?.local_path || /link|html|url/i.test(proof.file_type))) issues.push('Nije povezan stvarni dokazni prilog');
    const expiry = task.proof_valid_until ? new Date(String(task.proof_valid_until).slice(0,10) + 'T23:59:59.999Z').getTime() : null;
    if (expiry !== null && expiry < coverageThrough) issues.push('Dokaz ističe prije predaje ili je već istekao');
    return { ...task, issues, proof_name: proof?.name || null };
  });
  const incomplete = assessed.filter(t => t.issues.length);
  if (incomplete.length) blockers.push(`${incomplete.length} stavki zahtijeva dopunu ili provjeru.`);
  const fingerprint = createHash('sha256').update(JSON.stringify({
    workspace, tasks: [...tasks].sort((a,b) => a.id.localeCompare(b.id)),
    docs: [...docs].sort((a,b) => a.id.localeCompare(b.id)).map(d => ({ id: d.id, name: d.name, text: d.parsed_text, path: d.local_path, size: d.file_size, scraped: d.scraped_at })),
    deadline: tender.deadline, updated: tender.updated_at,
  })).digest('hex');
  return { blockers, tasks: assessed, fingerprint, ready: !blockers.length, verified: tasks.length - incomplete.length, total: tasks.length };
}
