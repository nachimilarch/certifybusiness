import winston from "winston";
import path from "path";
import fs from "fs";
import { config } from "./config";

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

if (config.isProd || process.env.LOG_DIR) {
  fs.mkdirSync(config.logging.dir, { recursive: true });
}

const fileTransports =
  config.isProd
    ? [
        new winston.transports.File({
          filename: path.join(config.logging.dir, "error.log"),
          level: "error",
          maxsize: 10 * 1024 * 1024,
          maxFiles: 5,
        }),
        new winston.transports.File({
          filename: path.join(config.logging.dir, "combined.log"),
          maxsize: 20 * 1024 * 1024,
          maxFiles: 10,
        }),
      ]
    : [];

export const logger = winston.createLogger({
  level: config.logging.level,
  format: combine(timestamp(), errors({ stack: true }), json()),
  transports: [
    ...fileTransports,
    new winston.transports.Console({
      format: config.isDev ? combine(colorize(), simple()) : combine(timestamp(), json()),
    }),
  ],
});

export function requestLogger() {
  return (
    req: import("express").Request,
    res: import("express").Response,
    next: import("express").NextFunction
  ) => {
    const start = Date.now();
    res.on("finish", () => {
      logger.http(`${req.method} ${req.originalUrl}`, {
        status: res.statusCode,
        duration: Date.now() - start,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      });
    });
    next();
  };
}
