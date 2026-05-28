import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import { logger } from "../lib/logger";

export const ejnRouter = Router();
ejnRouter.use(authMiddleware);

const EJN_BASE = "https://open.ejn.gov.ba";

ejnRouter.get("/*path", async (req, res) => {
  const path = req.path.slice(1);
  const queryParams = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query)) {
    if (typeof v === "string") queryParams.set(k, v);
  }
  if (!queryParams.has("$format")) queryParams.set("$format", "json");

  const url = `${EJN_BASE}/${path}${queryParams.toString() ? "?" + queryParams.toString() : ""}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "ASA-Tender-Intelligence/1.0",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      res.status(response.status).json({ error: `EJN API returned ${response.status}` });
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    logger.error({ err, url }, "EJN proxy error");
    res.status(502).json({ error: "EJN API nije dostupan" });
  }
});
