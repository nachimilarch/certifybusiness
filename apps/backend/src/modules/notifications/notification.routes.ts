import { Router } from "express";
import { authenticate } from "../../core/middleware/auth.middleware";
import * as ctrl from "./notification.controller";

export const notificationRouter = Router();
notificationRouter.use(authenticate);

notificationRouter.get("/", ctrl.getNotifications);
notificationRouter.get("/unread-count", ctrl.getUnreadCount);
notificationRouter.patch("/:id/read", ctrl.markRead);
notificationRouter.post("/read-all", ctrl.markAllRead);
