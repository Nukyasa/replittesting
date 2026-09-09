/** Pure EJN mapping and single-process coordination, also used by fixture tests. */
export type EjnRow = Record<string, any>;

export function parseEjnDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number) as [number, number, number];
  if (year < 2000 || month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function parseEjnAmount(value: unknown): number | null {
  if ((typeof value !== "number" && typeof value !== "string") || String(value).trim() === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function procedureIdentity(item: EjnRow): string {
  if (!Number.isSafeInteger(item.ProcedureId) || item.ProcedureId <= 0) throw new Error("EJN obavještenje nema ispravan ProcedureId.");
  return `ejn:procedure:${item.ProcedureId}`;
}

export function announcementTime(item: EjnRow): number {
  return parseEjnDate(item.Announced)?.getTime() ?? 0;
}

export function compareAnnouncements(left: EjnRow, right: EjnRow): number {
  return announcementTime(left) - announcementTime(right)
    || (parseEjnDate(left.LastUpdated)?.getTime() ?? 0) - (parseEjnDate(right.LastUpdated)?.getTime() ?? 0)
    || Number(left.Id ?? 0) - Number(right.Id ?? 0);
}

export function summarizeLots(lots: EjnRow[]) {
  const amounts = lots.map(lot => parseEjnAmount(lot.EstimatedValue));
  // A partial sum would incorrectly claim to be the value of the whole tender.
  const estimatedValue = amounts.length > 0 && amounts.every(value => value !== null)
    ? amounts.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null;
  const lotDeadlines = lots.map(lot => ({
    lotId: lot.Id,
    deadline: parseEjnDate(lot.ProcurementPhaseOfferSubmissionDeadline)
      ?? parseEjnDate(lot.IntermediatePhaseOfferSubmissionDeadline)
      ?? parseEjnDate(lot.intermediatePhaseOfferSubmissionDeadline)
      ?? parseEjnDate(lot.ApplicationDeadlineDateTime),
  }));
  const dates = lotDeadlines.flatMap(lot => lot.deadline ? [lot.deadline] : []);
  // Show the first submission deadline so an earlier lot is never missed.
  const deadline = dates.length ? new Date(Math.min(...dates.map(date => date.getTime()))) : null;
  return {
    estimatedValue: estimatedValue !== null && Number.isFinite(estimatedValue) ? estimatedValue : null,
    deadline,
    deadlineSource: deadline ? "earliest_lot_submission" : "unknown",
    lotDeadlines: lotDeadlines.map(lot => ({ ...lot, deadline: lot.deadline?.toISOString() ?? null })),
  };
}

export function noticeStatus(item: EjnRow, lots: EjnRow[], deadline: Date | null, now = new Date()) {
  const type = String(item.NoticeType ?? "").toLowerCase();
  if (/termination|repeal|cancellation/.test(type)) return { status: "cancelled", statusName: "Poništen" };
  if (type.includes("award")) return { status: "closed", statusName: "Dodijeljen ugovor" };
  if (deadline && deadline < now) {
    const lotDeadlines = summarizeLots(lots).lotDeadlines;
    if (lotDeadlines.some(lot => lot.deadline && new Date(lot.deadline) > now)) return { status: "open", statusName: "Dio rokova istekao" };
    if (lotDeadlines.some(lot => !lot.deadline)) return { status: "open", statusName: "Provjeriti rokove lotova" };
    return { status: "closed", statusName: "Rok istekao" };
  }
  if (lots.some(lot => lot.HasComplaint === true)) return { status: "open", statusName: "Uložena žalba" };
  return { status: "open", statusName: deadline ? "Aktivan" : "Rok nije objavljen" };
}

export class SyncAlreadyRunningError extends Error {
  constructor() { super("Preuzimanje EJN tendera je već u toku."); }
}

export class SyncGate {
  private active = false;
  get isRunning() { return this.active; }
  acquire(): () => void {
    if (this.active) throw new SyncAlreadyRunningError();
    this.active = true;
    let released = false;
    return () => { if (!released) { released = true; this.active = false; } };
  }
}
