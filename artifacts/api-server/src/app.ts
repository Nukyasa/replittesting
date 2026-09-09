import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res, _next, options) => {
    const retryAfter = Math.ceil(options.windowMs / 1000);
    res.status(429).json({ error: `Previše zahtjeva, pokušajte ponovo za ${retryAfter} sekundi.` });
  },
});


app.use(globalLimiter);
app.use("/api", router);

// Serve static frontend build in production / standalone mode
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const possibleFrontendDirs = [
  path.resolve(process.cwd(), "artifacts/tender-app/dist/public"),
  path.resolve(process.cwd(), "../tender-app/dist/public"),
  path.resolve(process.cwd(), "../../artifacts/tender-app/dist/public"),
  path.resolve(currentDir, "../../tender-app/dist/public"),
  path.resolve(currentDir, "../tender-app/dist/public"),
];
const frontendDir = possibleFrontendDirs.find(d => fs.existsSync(d));

if (frontendDir) {
  logger.info({ frontendDir }, "Serving static frontend build");
  app.use(express.static(frontendDir));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(frontendDir, "index.html"));
  });
}

export default app;
