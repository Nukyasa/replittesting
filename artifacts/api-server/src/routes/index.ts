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

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/tenders", tendersRouter);
router.use("/analytics", analyticsRouter);
router.use("/scraper", scraperRouter);
router.use("/notifications", notificationsRouter);
router.use("/users", usersRouter);
router.use("/profile", profileRouter);
router.use("/ejn", ejnRouter);

export default router;
