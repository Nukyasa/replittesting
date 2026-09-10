import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";
import { PRIMARY_ALERT_EMAIL, sendTestEmail } from "../services/emailNotificationService";

export const notificationsRouter = Router();
notificationsRouter.use(authMiddleware);

notificationsRouter.get("/", async (req, res) => {
  const notifications = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, req.user!.id))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);

  res.json(notifications);
});

notificationsRouter.patch("/read-all", async (req, res) => {
  await db
    .update(notificationsTable)
    .set({ read: true })
    .where(eq(notificationsTable.userId, req.user!.id));

  res.json({ ok: true });
});

notificationsRouter.patch("/:id/read", async (req, res) => {
  await db
    .update(notificationsTable)
    .set({ read: true })
    .where(
      and(
        eq(notificationsTable.id, req.params.id),
        eq(notificationsTable.userId, req.user!.id)
      )
    );

  res.json({ ok: true });
});

notificationsRouter.get("/email-config", async (_req, res) => {
  res.json({
    recipient: PRIMARY_ALERT_EMAIL,
    smtpConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
  });
});

notificationsRouter.post("/test-email", async (req, res) => {
  try {
    const target = (req.body.email as string) || PRIMARY_ALERT_EMAIL;
    const result = await sendTestEmail(target);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Greška pri slanju testnog emaila" });
  }
});

