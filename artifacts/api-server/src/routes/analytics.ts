import { Router } from "express";
import { db } from "@workspace/db";
import {
  tendersTable,
  aiAnalysisTable,
  userTendersTable,
} from "@workspace/db";
import { eq, sql, gte, lte, and, desc, asc } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";
import { getAsaScopeCondition } from "./tenders";

export const analyticsRouter = Router();
analyticsRouter.use(authMiddleware);

analyticsRouter.get("/summary", async (req, res) => {
  const userId = req.user!.id;
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const scopeCond = getAsaScopeCondition("asa");

  const [
    [{ total }],
    [{ open }],
    avgData,
    [{ totalVal }],
    [{ highRel }],
    [{ exp7 }],
    [{ exp30 }],
    [{ newToday }],
    [{ watchCount }],
  ] = await Promise.all([
    db.select({ total: sql<number>`count(*)::int` }).from(tendersTable).where(scopeCond),
    db
      .select({ open: sql<number>`count(*)::int` })
      .from(tendersTable)
      .where(and(scopeCond, eq(tendersTable.status, "open"), gte(tendersTable.deadline, now))),
    db
      .select({ avg: sql<number>`avg(relevance_score)` })
      .from(aiAnalysisTable)
      .innerJoin(tendersTable, eq(aiAnalysisTable.tenderId, tendersTable.id))
      .where(scopeCond),
    db
      .select({ totalVal: sql<number>`coalesce(sum(estimated_value), 0)` })
      .from(tendersTable)
      .where(and(scopeCond, eq(tendersTable.status, "open"), gte(tendersTable.deadline, now))),
    db
      .select({ highRel: sql<number>`count(*)::int` })
      .from(aiAnalysisTable)
      .innerJoin(tendersTable, eq(aiAnalysisTable.tenderId, tendersTable.id))
      .where(and(scopeCond, gte(aiAnalysisTable.relevanceScore, 75))),
    db
      .select({ exp7: sql<number>`count(*)::int` })
      .from(tendersTable)
      .where(
        and(
          scopeCond,
          eq(tendersTable.status, "open"),
          gte(tendersTable.deadline, now),
          lte(tendersTable.deadline, in7Days)
        )
      ),
    db
      .select({ exp30: sql<number>`count(*)::int` })
      .from(tendersTable)
      .where(
        and(
          scopeCond,
          eq(tendersTable.status, "open"),
          gte(tendersTable.deadline, now),
          lte(tendersTable.deadline, in30Days)
        )
      ),
    db
      .select({ newToday: sql<number>`count(*)::int` })
      .from(tendersTable)
      .where(and(scopeCond, gte(tendersTable.createdAt, todayStart))),
    db
      .select({ watchCount: sql<number>`count(*)::int` })
      .from(userTendersTable)
      .where(eq(userTendersTable.userId, userId)),
  ]);

  res.json({
    totalTenders: total,
    openTenders: open,
    avgRelevanceScore: Math.round((avgData[0]?.avg ?? 0) * 10) / 10,
    totalEstimatedValue: totalVal ?? 0,
    highRelevance: highRel,
    expiringIn7Days: exp7,
    expiringIn30Days: exp30,
    newToday: newToday,
    watchlistCount: watchCount,
  });
});

analyticsRouter.get("/by-category", async (_req, res) => {
  const scopeCond = getAsaScopeCondition("asa");
  const rows = await db
    .select({
      id: tendersTable.id,
      title: tendersTable.title,
      description: tendersTable.description,
      cpvCodes: tendersTable.cpvCodes,
      category: tendersTable.category,
    })
    .from(tendersTable)
    .where(scopeCond);

  const counts: Record<string, number> = {
    "Vozila (AO & Kasko)": 0,
    "Imovina i objekti": 0,
    "Nezgoda i lica": 0,
    "Zdravstveno (DZO)": 0,
    "Odgovornost": 0,
    "Tehnički pregled vozila": 0,
  };

  for (const r of rows) {
    const title = (r.title || "").toLowerCase();
    const cpvs = (r.cpvCodes || []).map((c: any) => String(c));

    if (cpvs.some(c => c.startsWith("716312")) || title.includes("tehničk") || title.includes("tehnick")) {
      counts["Tehnički pregled vozila"]++;
    } else if (cpvs.some(c => c.startsWith("665141")) || title.includes("kasko") || title.includes("vozil") || title.includes("autoodgovornost")) {
      counts["Vozila (AO & Kasko)"]++;
    } else if (cpvs.some(c => c.startsWith("66515")) || title.includes("imovin") || title.includes("požar") || title.includes("pozar")) {
      counts["Imovina i objekti"]++;
    } else if (cpvs.some(c => c.startsWith("665122")) || title.includes("zdravstven") || title.includes("dzo")) {
      counts["Zdravstveno (DZO)"]++;
    } else if (cpvs.some(c => c.startsWith("66516")) || title.includes("odgovornost")) {
      counts["Odgovornost"]++;
    } else {
      counts["Nezgoda i lica"]++;
    }
  }

  const result = Object.entries(counts).map(([category, count]) => ({
    category,
    count,
    avgScore: 80,
  })).sort((a, b) => b.count - a.count);

  res.json(result);
});

analyticsRouter.get("/by-entity", async (_req, res) => {
  const rows = await db
    .select({
      entity: tendersTable.entity,
      count: sql<number>`count(*)::int`,
    })
    .from(tendersTable)
    .groupBy(tendersTable.entity)
    .orderBy(sql`count(*) desc`);

  res.json(rows);
});

analyticsRouter.get("/timeline", async (_req, res) => {
  const rows = await db.execute(sql`
    SELECT 
      to_char(created_at::date, 'YYYY-MM-DD') as date,
      count(*)::int as count
    FROM tenders
    WHERE created_at >= now() - interval '30 days'
    GROUP BY created_at::date
    ORDER BY created_at::date ASC
  `);

  res.json(rows.rows);
});

analyticsRouter.get("/score-dist", async (_req, res) => {
  const ranges = [
    { range: "0-20", min: 0, max: 20 },
    { range: "21-40", min: 21, max: 40 },
    { range: "41-60", min: 41, max: 60 },
    { range: "61-80", min: 61, max: 80 },
    { range: "81-100", min: 81, max: 100 },
  ];

  const result = await Promise.all(
    ranges.map(async ({ range, min, max }) => {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(aiAnalysisTable)
        .where(
          and(
            gte(aiAnalysisTable.relevanceScore, min),
            lte(aiAnalysisTable.relevanceScore, max)
          )
        );
      return { range, count };
    })
  );

  res.json(result);
});

analyticsRouter.get("/expiring", async (req, res) => {
  const days = parseInt((req.query.days as string) || "30");
  const now = new Date();
  const limit = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const tenders = await db
    .select()
    .from(tendersTable)
    .where(
      and(
        eq(tendersTable.status, "open"),
        gte(tendersTable.deadline, now),
        lte(tendersTable.deadline, limit)
      )
    )
    .orderBy(asc(tendersTable.deadline))
    .limit(50);

  res.json(tenders);
});
