import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { authMiddleware, adminOnly } from "../middlewares/auth";
import { nanoid } from "../lib/nanoid";

export const usersRouter = Router();
usersRouter.use(authMiddleware);

usersRouter.get("/", adminOnly, async (_req, res) => {
  const users = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      role: usersTable.role,
      department: usersTable.department,
      companyTags: usersTable.companyTags,
      lastLogin: usersTable.lastLogin,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable);

  res.json(users);
});

usersRouter.post("/", adminOnly, async (req, res) => {
  const { email, password, name, role = "user", department } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: "Email, password and name are required" });
  }

  const hash = await bcrypt.hash(password, 12);
  const [user] = await db
    .insert(usersTable)
    .values({
      id: nanoid(),
      email,
      password: hash,
      name,
      role,
      department: department ?? null,
    })
    .returning();

  const { password: _p, ...safeUser } = user;
  return res.status(201).json(safeUser);
});

usersRouter.patch("/:id", adminOnly, async (req, res) => {
  const { name, role, department } = req.body;
  const updates: Record<string, unknown> = {};
  if (name) updates.name = name;
  if (role) updates.role = role;
  if (department !== undefined) updates.department = department;

  const [user] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, req.params.id as string))
    .returning();

  if (!user) return res.status(404).json({ error: "User not found" });
  const { password: _p, ...safeUser } = user;
  return res.json(safeUser);
});

usersRouter.delete("/:id", adminOnly, async (req, res) => {
  await db.delete(usersTable).where(eq(usersTable.id, req.params.id as string));
  res.status(204).send();
});

usersRouter.put("/profile", async (req, res) => {
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
