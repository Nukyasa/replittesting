import { Router } from "express";
import { db } from "@workspace/db";
import { pipelineRunsTable, tenderAlertsTable, scraperLogsTable, tendersTable, aiAnalysisTable, notificationsTable, userTendersTable } from "@workspace/db";
import { eq, desc, and, gte, sql, lte, asc, isNull } from "drizzle-orm";
import { MonitoringService } from "../services/monitoringService";
import { authMiddleware } from "../middlewares/auth";
import { TenderPreparationPipeline } from "../services/tenderPipeline";

export const monitoringRouter = Router();
monitoringRouter.use(authMiddleware);

monitoringRouter.get("/stats", async (_req, res) => {
  try {
    const [
      systemStats,
      pipelineStats,
      alertStats,
      recentRuns,
      recentAlerts,
      issues,
      syncHealth,
    ] = await Promise.all([
      MonitoringService.getSystemStats(),
      MonitoringService.getPipelineStats(),
      MonitoringService.getAlertStats(),
      MonitoringService.getRecentPipelineRuns(),
      MonitoringService.getRecentAlerts(),
      MonitoringService.getTendersWithIssues(),
      MonitoringService.getSyncHealth(),
    ]);

    res.json({
      system: systemStats,
      pipeline: pipelineStats,
      alerts: alertStats,
      recentRuns,
      recentAlerts,
      issues,
      syncHealth,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch monitoring stats", message: err.message });
  }
});

monitoringRouter.get("/alerts", async (req, res) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const alerts = await db.select().from(tenderAlertsTable)
      .orderBy(desc(tenderAlertsTable.createdAt))
      .limit(limit);
    
    res.json(alerts);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch alerts", message: err.message });
  }
});

monitoringRouter.post("/alerts/:id/resolve", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const [alert] = await db.update(tenderAlertsTable)
      .set({ isResolved: true, resolvedBy: userId, resolvedAt: new Date() })
      .where(eq(tenderAlertsTable.id, id))
      .returning();

    res.json(alert);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to resolve alert", message: err.message });
  }
});

monitoringRouter.get("/pipeline/runs", async (req, res) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const tenderId = req.query.tenderId as string | undefined;

    let query = db.select().from(pipelineRunsTable);
    
    if (tenderId) {
      query = query.where(eq(pipelineRunsTable.tenderId, tenderId));
    }

    const runs = await query.orderBy(desc(pipelineRunsTable.createdAt)).limit(limit);
    res.json(runs);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch pipeline runs", message: err.message });
  }
});

monitoringRouter.get("/system", async (_req, res) => {
  try {
    const stats = await MonitoringService.getSystemStats();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch system stats", message: err.message });
  }
});

monitoringRouter.get("/tenders/expiring", async (_req, res) => {
  try {
    const oneWeekFromNow = new Date();
    oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);

    const expiringTenders = await db.select({
      id: tendersTable.id,
      title: tendersTable.title,
      contractingAuth: tendersTable.contractingAuth,
      deadline: tendersTable.deadline,
      estimatedValue: tendersTable.estimatedValue,
      relevanceScore: aiAnalysisTable.relevanceScore,
      status: tendersTable.status,
    })
    .from(tendersTable)
    .leftJoin(aiAnalysisTable, eq(tendersTable.id, aiAnalysisTable.tenderId))
    .where(and(
      gte(tendersTable.deadline, new Date()),
      lte(tendersTable.deadline, oneWeekFromNow),
      eq(tendersTable.status, "open")
    ))
    .orderBy(asc(tendersTable.deadline))
    .limit(50);

    res.json(expiringTenders);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch expiring tenders", message: err.message });
  }
});

monitoringRouter.get("/tenders/no-analysis", async (_req, res) => {
  try {
    const tendersWithoutAnalysis = await db.select({
      id: tendersTable.id,
      title: tendersTable.title,
      contractingAuth: tendersTable.contractingAuth,
      deadline: tendersTable.deadline,
      status: tendersTable.status,
      createdAt: tendersTable.createdAt,
    })
    .from(tendersTable)
    .leftJoin(aiAnalysisTable, eq(tendersTable.id, aiAnalysisTable.tenderId))
    .where(isNull(aiAnalysisTable.id))
    .orderBy(desc(tendersTable.createdAt))
    .limit(50);

    res.json(tendersWithoutAnalysis);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch tenders without analysis", message: err.message });
  }
});

export default monitoringRouter;
