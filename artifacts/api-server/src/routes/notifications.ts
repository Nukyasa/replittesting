import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";

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

notificationsRouter.delete("/:id", async (req, res) => {
  await db
    .delete(notificationsTable)
    .where(
      and(
        eq(notificationsTable.id, req.params.id),
        eq(notificationsTable.userId, req.user!.id)
      )
    );

  res.status(204).send();
});
