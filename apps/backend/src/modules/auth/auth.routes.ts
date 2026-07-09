import { Router } from "express";
import rateLimit from "express-rate-limit";
import { validate } from "../../core/middleware/validate.middleware";
import { authenticate } from "../../core/middleware/auth.middleware";
import { LoginSchema, RefreshSchema, ChangePasswordSchema } from "./auth.schema";
import * as ctrl from "./auth.controller";

export const authRouter = Router();

// Stricter rate limit on login to prevent brute-force
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.ip ?? "unknown",
  message: { success: false, code: "TOO_MANY_REQUESTS", message: "Too many login attempts" },
});

authRouter.post("/login", loginLimiter, validate(LoginSchema), ctrl.login);
authRouter.post("/refresh", validate(RefreshSchema), ctrl.refresh);
authRouter.post("/logout", validate(RefreshSchema), ctrl.logout);

// Protected
authRouter.get("/me", authenticate, ctrl.me);
authRouter.post("/logout-all", authenticate, ctrl.logoutAll);
authRouter.post(
  "/change-password",
  authenticate,
  validate(ChangePasswordSchema),
  ctrl.changePassword
);
