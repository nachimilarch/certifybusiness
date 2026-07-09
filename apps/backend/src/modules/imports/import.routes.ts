import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authenticate } from "../../core/middleware/auth.middleware";
import { requirePermission, requireMinRole } from "../../core/middleware/rbac.middleware";
import { config } from "../../core/config";
import * as ctrl from "./import.controller";

// ─── Multer configuration ─────────────────────────────────────────────────────

const UPLOAD_PATH = path.join(config.storage.uploadDir, "imports");
fs.mkdirSync(UPLOAD_PATH, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_PATH),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    cb(null, `${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter(_req, file, cb) {
    const allowed = [".csv", ".txt"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new Error("Only CSV files are accepted"));
    }
    cb(null, true);
  },
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const importRouter = Router();
importRouter.use(authenticate);

// Upload a CSV list — permission check happens in the controller, after the
// multipart body is parsed and the channel is known (see uploadList).
importRouter.post("/upload", upload.single("file"), ctrl.uploadList);

importRouter.get("/lists", ctrl.getLists);
importRouter.get("/contacts", ctrl.getAllContactsController);
importRouter.get("/lists/:id", ctrl.getList);
importRouter.get("/lists/:id/contacts", ctrl.getContacts);
importRouter.delete("/lists/:id", ctrl.removeList);

// Admin-only: pending approvals queue and approve/reject action
importRouter.get("/pending-approvals", requireMinRole("admin"), ctrl.getPendingApprovalsController);
importRouter.post("/lists/:id/approve", requireMinRole("admin"), ctrl.approveUploadController);
