import { and, eq, gte } from "drizzle-orm";
import { db, companyProfileTable, marketProfilesTable, notificationsTable, tendersTable, userTendersTable, usersTable } from "@workspace/db";
import { nanoid } from "../lib/nanoid";

type TenderForNotification = { id: string; title: string; description?: string | null; cpvCodes?: string[] | null; deadline?: Date | null };
const normalize = (value: string) => value.toLocaleLowerCase("bs").normalize("NFKD").replace(/[^a-z0-9čćžšđ]+/gi, " ");
const terms = (values: string[]) => [...new Set(values.flatMap(value => normalize(value).split(/\s+/).filter(word => word.length >= 4)))];
type Market = { id: string; userId: string; cpvCodes: string[]; keywords: string[]; authorityNames: string[]; minValue: number | null; maxValue: number | null; openOnly: boolean };
function marketReasons(market: Market, tender: TenderForNotification & { contractingAuth?: string | null; estimatedValue?: number | null; status?: string | null }) {
  if (market.openOnly && tender.status && tender.status !== "open") return [];
  if (market.minValue !== null && (tender.estimatedValue === null || tender.estimatedValue === undefined || tender.estimatedValue < market.minValue)) return [];
  if (market.maxValue !== null && (tender.estimatedValue === null || tender.estimatedValue === undefined || tender.estimatedValue > market.maxValue)) return [];
  const text = normalize(`${tender.title} ${tender.description || ""}`);
  const cpv = new Set(tender.cpvCodes || []);
  const reasons = [
    ...market.cpvCodes.filter(code => cpv.has(code)).map(code => `CPV ${code}`),
    ...terms(market.keywords).filter(term => text.includes(term)).map(term => `pojam „${term}“`),
    ...market.authorityNames.filter(authority => normalize(tender.contractingAuth || "").includes(normalize(authority))).map(authority => `kupac „${authority}“`),
  ];
  const hasCriteria = market.cpvCodes.length || market.keywords.length || market.authorityNames.length;
  return hasCriteria ? [...new Set(reasons)] : ["opće tržište"];
}

async function notificationExists(userId: string, tenderId: string, type: string) {
  return Boolean(await db.query.notificationsTable.findFirst({ where: and(eq(notificationsTable.userId, userId), eq(notificationsTable.tenderId, tenderId), eq(notificationsTable.type, type)) }));
}

/** Notify only when the tender matches stated company/user criteria; matching terms are shown to the user. */
export async function notifyMatchedTender(tender: TenderForNotification & { contractingAuth?: string | null; estimatedValue?: number | null; status?: string | null }) {
  const [[profile], users, markets] = await Promise.all([
    db.select().from(companyProfileTable).limit(1),
    db.select({ id: usersTable.id, companyTags: usersTable.companyTags }).from(usersTable),
    db.select().from(marketProfilesTable),
  ]);
  const tenderText = normalize(`${tender.title} ${tender.description || ""} ${(tender.cpvCodes || []).join(" ")}`);
  const notifications = [];
  for (const user of users) {
    const criteria = terms([...(profile?.capabilities || []), ...(profile?.cpvCodes || []), ...(profile?.keywords || []), ...(user.companyTags || [])]);
    const matched = criteria.filter(term => tenderText.includes(term));
    if (matched.length && !await notificationExists(user.id, tender.id, "new_match")) {
      notifications.push({ id: nanoid(), userId: user.id, tenderId: tender.id, type: "new_match", read: false,
        title: "Novi tender koji odgovara kriterijima firme", message: `${tender.title} — podudaranje: ${matched.slice(0, 4).join(", ")}.` });
    }
    for (const market of markets.filter((item: Market) => item.userId === user.id)) {
      const reasons = marketReasons(market, tender);
      const type = `market_match:${market.id}`;
      if (!reasons.length || await notificationExists(user.id, tender.id, type)) continue;
      notifications.push({ id: nanoid(), userId: user.id, tenderId: tender.id, type, read: false,
        title: `Novo podudaranje: ${market.name}`, message: `${tender.title} — ${reasons.slice(0, 3).join(", ")}.` });
    }
  }
  if (notifications.length) await db.insert(notificationsTable).values(notifications);
}

/** Daily 7/3/1-day reminders for tenders a user actually follows or owns. */
export async function sendDeadlineReminders() {
  const now = new Date();
  const inSevenDays = new Date(now.getTime() + 7 * 86400000);
  const watched = await db.select({ userId: userTendersTable.userId, tenderId: tendersTable.id, title: tendersTable.title, deadline: tendersTable.deadline })
    .from(userTendersTable).innerJoin(tendersTable, eq(userTendersTable.tenderId, tendersTable.id))
    .where(and(eq(tendersTable.status, "open"), gte(tendersTable.deadline, now)));
  const notifications = [];
  for (const item of watched) {
    if (!item.deadline || item.deadline > inSevenDays) continue;
    const hours = (item.deadline.getTime() - now.getTime()) / 3600000;
    const day = [7, 3, 1].find(target => hours <= target * 24 && hours > (target - 1) * 24);
    if (!day) continue;
    const type = `deadline_${day}`;
    if (await notificationExists(item.userId, item.tenderId, type)) continue;
    notifications.push({ id: nanoid(), userId: item.userId, tenderId: item.tenderId, type, read: false,
      title: `Rok za predaju za ${day} ${day === 1 ? "dan" : "dana"}`, message: `${item.title} — rok: ${item.deadline.toLocaleString("bs-BA", { timeZone: "Europe/Sarajevo" })}.` });
  }
  if (notifications.length) await db.insert(notificationsTable).values(notifications);
  return notifications.length;
}
