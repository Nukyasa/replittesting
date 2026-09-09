
import { db, tendersTable, pipelineRunsTable, tenderAlertsTable, scraperLogsTable, userTendersTable, aiAnalysisTable } from "@workspace/db";
import { eq, desc, sql, and, gte, lte, or } from "drizzle-orm";

export interface SystemStats {
  totalTenders: number;
  openTenders: number;
  closedTenders: number;
  avgAnalysisScore: number;
  pendingPipeline: number;
  failedPipeline: number;
  activeAlerts: number;
  recentSyncs: number;
}

export interface PipelineStats {
  totalRuns: number;
  successRate: number;
  avgDuration: number;
  recentFailures: number;
  runsPerDay: number;
}

export interface AlertStats {
  totalAlerts: number;
  unresolvedAlerts: number;
  criticalAlerts: number;
  byType: Record<string, number>;
}

export class MonitoringService {
  static async getSystemStats(): Promise<SystemStats> {
    const [
      totalTenders,
      openTenders,
      closedTenders,
      avgAnalysisScore,
      pendingPipeline,
      failedPipeline,
      activeAlerts,
      recentSyncs,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(tendersTable),
      db.select({ count: sql<number>`count(*)::int` }).from(tendersTable).where(eq(tendersTable.status, "open")),
      db.select({ count: sql<number>`count(*)::int` }).from(tendersTable).where(eq(tendersTable.status, "closed")),
      db.select({ avg: sql<number>`avg(relevance_score)::float` }).from(aiAnalysisTable),
      db.select({ count: sql<number>`count(*)::int` }).from(pipelineRunsTable).where(eq(pipelineRunsTable.status, "running")),
      db.select({ count: sql<number>`count(*)::int` }).from(pipelineRunsTable).where(eq(pipelineRunsTable.status, "failed")),
      db.select({ count: sql<number>`count(*)::int` }).from(tenderAlertsTable).where(eq(tenderAlertsTable.isResolved, false)),
      db.select({ count: sql<number>`count(*)::int` }).from(scraperLogsTable).where(
        gte(scraperLogsTable.startedAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
      ),
    ]);

    return {
      totalTenders: totalTenders[0]?.count ?? 0,
      openTenders: openTenders[0]?.count ?? 0,
      closedTenders: closedTenders[0]?.count ?? 0,
      avgAnalysisScore: Math.round((avgAnalysisScore[0]?.avg ?? 0) * 100) / 100,
      pendingPipeline: pendingPipeline[0]?.count ?? 0,
      failedPipeline: failedPipeline[0]?.count ?? 0,
      activeAlerts: activeAlerts[0]?.count ?? 0,
      recentSyncs: recentSyncs[0]?.count ?? 0,
    };
  }

  static async getPipelineStats(): Promise<PipelineStats> {
    const totalRuns = await db.select({ count: sql<number>`count(*)::int` }).from(pipelineRunsTable);
    const successRuns = await db.select({ count: sql<number>`count(*)::int` }).from(pipelineRunsTable).where(eq(pipelineRunsTable.status, "completed"));
    const failedRuns = await db.select({ count: sql<number>`count(*)::int` }).from(pipelineRunsTable).where(eq(pipelineRunsTable.status, "failed"));
    const avgDuration = await db.select({ avg: sql<number>`avg(duration_ms)::float` }).from(pipelineRunsTable).where(eq(pipelineRunsTable.status, "completed"));
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const runsThisWeek = await db.select({ count: sql<number>`count(*)::int` }).from(pipelineRunsTable)
      .where(gte(pipelineRunsTable.createdAt, new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)));

    return {
      totalRuns: totalRuns[0]?.count ?? 0,
      successRate: totalRuns[0]?.count ? Math.round((successRuns[0]?.count / totalRuns[0]?.count) * 100) : 0,
      avgDuration: Math.round(avgDuration[0]?.avg ?? 0),
      recentFailures: failedRuns[0]?.count ?? 0,
      runsPerDay: runsThisWeek[0]?.count ? Math.round(runsThisWeek[0].count / 7) : 0,
    };
  }

  static async getAlertStats(): Promise<AlertStats> {
    const totalAlerts = await db.select({ count: sql<number>`count(*)::int` }).from(tenderAlertsTable);
    const unresolvedAlerts = await db.select({ count: sql<number>`count(*)::int` }).from(tenderAlertsTable).where(
      and(
        eq(tenderAlertsTable.isResolved, false),
        eq(tenderAlertsTable.severity, "critical")
      )
    );
    
    const byType = await db.select({ 
      type: tenderAlertsTable.type, 
      count: sql<number>`count(*)::int` 
    }).from(tenderAlertsTable)
      .where(eq(tenderAlertsTable.isResolved, false))
      .groupBy(tenderAlertsTable.type);

    return {
      totalAlerts: totalAlerts[0]?.count ?? 0,
      unresolvedAlerts: unresolvedAlerts[0]?.count ?? 0,
      criticalAlerts: unresolvedAlerts[0]?.count ?? 0,
      byType: byType.reduce((acc: any, row: any) => ({ ...acc, [row.type]: row.count }), {}),
    };
  }

  static async getRecentPipelineRuns(limit: number = 20) {
    return await db.select().from(pipelineRunsTable)
      .orderBy(desc(pipelineRunsTable.createdAt))
      .limit(limit);
  }

  static async getRecentAlerts(limit: number = 20) {
    return await db.select().from(tenderAlertsTable)
      .orderBy(desc(tenderAlertsTable.createdAt))
      .limit(limit);
  }

  static async getTendersWithIssues() {
    const failedButNotAnalyzed = await db.select({
      tender: tendersTable,
      lastRun: pipelineRunsTable,
    }).from(tendersTable)
      .innerJoin(pipelineRunsTable, eq(tendersTable.id, pipelineRunsTable.tenderId))
      .where(and(
        eq(pipelineRunsTable.status, "failed"),
        eq(tendersTable.status, "open")
      ))
      .orderBy(desc(pipelineRunsTable.createdAt))
      .limit(10);

    return failedButNotAnalyzed;
  }

  static async getSyncHealth() {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentLogs = await db.select().from(scraperLogsTable)
      .where(gte(scraperLogsTable.startedAt, last24h))
      .orderBy(desc(scraperLogsTable.startedAt))
      .limit(10);

    const successRate = recentLogs.length > 0 
      ? Math.round((recentLogs.filter((l: any) => l.status === "completed").length / recentLogs.length) * 100)
      : 0;

    return {
      logs: recentLogs,
      successRate,
      totalLogs: recentLogs.length,
    };
  }
}
