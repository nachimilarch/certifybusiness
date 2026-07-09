import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors";
import { logger } from "../logger";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    res.status(422).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      errors: err.errors.map((e) => ({ path: e.path.join("."), message: e.message })),
    });
    return;
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(err.message, { stack: err.stack, code: err.code });
    }
    res.status(err.statusCode).json({
      success: false,
      code: err.code || "ERROR",
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  if (err instanceof Error) {
    logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });
  } else {
    logger.error("Unhandled error", { err: String(err) });
  }
  res.status(500).json({
    success: false,
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred",
  });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ success: false, code: "NOT_FOUND", message: "Route not found" });
}
