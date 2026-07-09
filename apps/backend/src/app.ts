import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config } from "./core/config";
import { requestLogger } from "./core/logger";
import { errorHandler, notFoundHandler } from "./core/middleware/error.middleware";
import { auditMutations } from "./core/middleware/audit.middleware";
import { registerRoutes } from "./modules";

export function createApp(): express.Express {
  const app = express();

  // ─── Security ───────────────────────────────────────────────────────────────
  app.use(helmet());
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  // ─── CORS ───────────────────────────────────────────────────────────────────
  app.use(
    cors({
      origin: [config.frontendUrl, config.appUrl],
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  // ─── Body parsing ───────────────────────────────────────────────────────────
  // WhatsApp webhook needs raw body for HMAC signature verification
  app.use("/webhooks/whatsapp", express.raw({ type: "*/*", limit: "1mb" }));
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // ─── Request logging ────────────────────────────────────────────────────────
  app.use(requestLogger());

  // ─── Audit logging (every successful mutation, org-wide) ───────────────────
  app.use(auditMutations());

  // ─── Global rate limit ──────────────────────────────────────────────────────
  app.use(
    "/api",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 500,
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, code: "TOO_MANY_REQUESTS", message: "Too many requests" },
    })
  );

  // ─── Health check ───────────────────────────────────────────────────────────
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", ts: new Date().toISOString() });
  });

  // ─── API routes ─────────────────────────────────────────────────────────────
  registerRoutes(app);

  // ─── 404 + error handlers ───────────────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
