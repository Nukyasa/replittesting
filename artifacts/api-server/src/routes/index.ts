import { Router, type IRouter } from "express";
import healthRouter from "./health";
import { authRouter } from "./auth";
import { tendersRouter } from "./tenders";
import { analyticsRouter } from "./analytics";
import { scraperRouter } from "./scraper";
import { notificationsRouter } from "./notifications";
import { usersRouter } from "./users";
import { profileRouter } from "./profile";
import { ejnRouter } from "./ejn";
import { monitoringRouter } from "./monitoring";
import { workspaceRouter } from "./workspace";
import { companyRouter } from "./company";
import { marketsRouter } from "./markets";
import { authoritiesRouter } from "./authorities";
import { suppliersRouter } from "./suppliers";
import { tenderProjectsRouter } from "./tender-projects";
import { resolutionsRouter } from "./resolutions";
import { earlyWarningRouter } from "./early-warning";
import { watchlistsRouter } from "./watchlists";
import { historyRouter } from "./history";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/tenders", tendersRouter);
router.use("/history", historyRouter);
router.use("/tender-projects", tenderProjectsRouter);
router.use("/resolutions", resolutionsRouter);
router.use("/early-warning", earlyWarningRouter);
router.use("/watchlists", watchlistsRouter);
router.use("/analytics", analyticsRouter);
router.use("/scraper", scraperRouter);
router.use("/notifications", notificationsRouter);
router.use("/users", usersRouter);
router.use("/profile", profileRouter);
router.use("/ejn", ejnRouter);
router.use("/monitoring", monitoringRouter);
router.use("/workspace", workspaceRouter);
router.use("/company", companyRouter);
router.use("/markets", marketsRouter);
router.use("/authorities", authoritiesRouter);
router.use("/suppliers", suppliersRouter);

export default router;

