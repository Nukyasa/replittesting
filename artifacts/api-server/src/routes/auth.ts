import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

export const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || "asa_tender_jwt_secret_2026";

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email i lozinka su obavezni" });
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) {
    return res.status(401).json({ error: "Pogrešni podaci za prijavu" });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: "Pogrešni podaci za prijavu" });
  }

  await db.update(usersTable).set({ lastLogin: new Date() }).where(eq(usersTable.id, user.id));

  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });

  const { password: _p, ...safeUser } = user;
  res.json({ token, user: safeUser });
});

authRouter.post("/logout", (_req, res) => {
  res.json({ ok: true });
});

authRouter.get("/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1);
    if (!user) return res.status(401).json({ error: "User not found" });
    const { password: _p, ...safeUser } = user;
    res.json(safeUser);
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
});
