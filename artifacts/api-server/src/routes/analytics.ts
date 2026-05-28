import { Router } from "express";
import { db } from "@workspace/db";
import {
  tendersTable,
  aiAnalysisTable,
  userTendersTable,
} from "@workspace/db";
import { eq, sql, gte, lte, and, desc, asc } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";

export const analyticsRouter = Router();
analyticsRouter.use(authMiddleware);

analyticsRouter.get("/summary", async (req, res) => {
  const userId = req.user!.id;
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

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
    db.select({ total: sql<number>`count(*)::int` }).from(tendersTable),
    db
      .select({ open: sql<number>`count(*)::int` })
      .from(tendersTable)
      .where(eq(tendersTable.status, "open")),
    db
      .select({ avg: sql<number>`avg(relevance_score)` })
      .from(aiAnalysisTable),
    db
      .select({ totalVal: sql<number>`coalesce(sum(estimated_value), 0)` })
      .from(tendersTable),
    db
      .select({ highRel: sql<number>`count(*)::int` })
      .from(aiAnalysisTable)
      .where(gte(aiAnalysisTable.relevanceScore, 75)),
    db
      .select({ exp7: sql<number>`count(*)::int` })
      .from(tendersTable)
      .where(
        and(
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
          eq(tendersTable.status, "open"),
          gte(tendersTable.deadline, now),
          lte(tendersTable.deadline, in30Days)
        )
      ),
    db
      .select({ newToday: sql<number>`count(*)::int` })
      .from(tendersTable)
      .where(gte(tendersTable.createdAt, todayStart)),
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
  const rows = await db
    .select({
      category: tendersTable.category,
      count: sql<number>`count(*)::int`,
      avgScore: sql<number>`coalesce(avg(a.relevance_score), 0)`,
    })
    .from(tendersTable)
    .leftJoin(aiAnalysisTable, eq(tendersTable.id, aiAnalysisTable.tenderId))
    .groupBy(tendersTable.category)
    .orderBy(sql`count(*) desc`);

  res.json(rows.map((r) => ({ ...r, avgScore: Math.round(r.avgScore) })));
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
