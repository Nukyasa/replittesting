import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import { logger } from "../lib/logger";

export const ejnRouter = Router();
ejnRouter.use(authMiddleware);

const EJN_BASE = "https://open.ejn.gov.ba";

const INSURANCE_FILTER =
  "contains(tolower(ProcedureName),'osiguranj') or " +
  "contains(tolower(ProcedureName),'kasko') or " +
  "contains(tolower(ProcedureName),'insurance') or " +
  "contains(tolower(ContractCategoryName),'osiguranj')";

const LOT_SELECT = [
  "Id", "ProcedureId", "ProcedureName",
  "ContractingAuthorityName", "ContractingAuthorityCityName",
  "ContractingAuthorityAdministrativeUnitName",
  "EstimatedValue", "Status",
  "ProcurementPhaseOfferSubmissionDeadline",
  "ApplicationDeadlineDateTime",
  "IsAuctionOnline", "AwardCriterion",
  "ContractCategoryName", "ContractType",
  "ShortDescription", "LastUpdated",
].join(",");

ejnRouter.get("/insurance-live", async (req, res) => {
  const top = Number(req.query["$top"] || "20");
  const skip = Number(req.query["$skip"] || "0");
  const search = (req.query.search as string) || "";

  let filter = `(${INSURANCE_FILTER})`;
  if (search) {
    filter += ` and contains(tolower(ProcedureName),'${search.toLowerCase().replace(/'/g, "''")}')`;
  }

  const qs = (s: string) => s.replace(/ /g, "%20").replace(/'/g, "%27");
  const url =
    `${EJN_BASE}/Lots` +
    `?$top=${top}` +
    `&$skip=${skip}` +
    `&$format=json` +
    `&$select=${LOT_SELECT}` +
    `&$filter=${qs(filter)}`;

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "ASA-Tender-Intelligence/1.0" },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      res.status(response.status).json({ error: `EJN API returned ${response.status}` });
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    logger.error({ err, url }, "EJN insurance-live proxy error");
    res.status(502).json({ error: "EJN API nije dostupan" });
  }
});

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
      signal: AbortSignal.timeout(30000),
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
