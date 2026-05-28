import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";

export const profileRouter = Router();
profileRouter.use(authMiddleware);

profileRouter.put("/", async (req, res) => {
  const { name, department, companyTags } = req.body;
  const updates: Record<string, unknown> = {};
  if (name) updates.name = name;
  if (department !== undefined) updates.department = department;
  if (companyTags) updates.companyTags = companyTags;

  const [user] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, req.user!.id))
    .returning();

  const { password: _p, ...safeUser } = user;
  res.json(safeUser);
});
