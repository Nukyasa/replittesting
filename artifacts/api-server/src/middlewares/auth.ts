import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const isDev = process.env.NODE_ENV !== "production";
const JWT_SECRET = process.env.JWT_SECRET ?? (isDev ? "asa_tender_jwt_secret_2026" : null);

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable must be set in production");
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
        email: string;
        name: string;
        department: string | null;
        companyTags: string[];
      };
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  let token = "";
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  } else if (req.query.token && typeof req.query.token === "string") {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET!) as { userId: string; role: string };
    const [user] = await db
      .select({
        id: usersTable.id,
        role: usersTable.role,
        email: usersTable.email,
        name: usersTable.name,
        department: usersTable.department,
        companyTags: usersTable.companyTags,
      })
      .from(usersTable)
      .where(eq(usersTable.id, payload.userId))
      .limit(1);

    if (!user) return res.status(401).json({ error: "User not found" });
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function adminOnly(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }
  return next();
}
