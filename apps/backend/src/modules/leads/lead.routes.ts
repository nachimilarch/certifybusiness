import { Router } from "express";
import { authenticate } from "../../core/middleware/auth.middleware";
import { requirePermission } from "../../core/middleware/rbac.middleware";
import { validate } from "../../core/middleware/validate.middleware";
import {
  CreateLeadSchema,
  UpdateLeadSchema,
  AddNoteSchema,
  AddPhoneSchema,
  AddEmailSchema,
  CreateTaskSchema,
  AssignLeadSchema,
} from "./lead.schema";
import * as ctrl from "./lead.controller";

export const leadRouter = Router();
leadRouter.use(authenticate);

// Duplicate check (before create)
leadRouter.post("/check-duplicate", ctrl.checkDuplicate);

// Leads CRUD
leadRouter.get("/", requirePermission("view_assigned_leads"), ctrl.listLeads);
leadRouter.post("/", validate(CreateLeadSchema), ctrl.createLead);
leadRouter.get("/:id", requirePermission("view_assigned_leads"), ctrl.getLead);
leadRouter.patch("/:id", validate(UpdateLeadSchema), ctrl.updateLead);
leadRouter.post("/:id/assign", validate(AssignLeadSchema), ctrl.assignLead);

// Phones
leadRouter.post("/:id/phones", validate(AddPhoneSchema), ctrl.addPhone);
leadRouter.delete("/:id/phones/:phoneId", ctrl.deletePhone);

// Emails
leadRouter.post("/:id/emails", validate(AddEmailSchema), ctrl.addEmail);
leadRouter.delete("/:id/emails/:emailId", ctrl.deleteEmail);

// Activities / notes
leadRouter.post("/:id/notes", validate(AddNoteSchema), ctrl.addNote);

// Tasks
leadRouter.post("/:id/tasks", validate(CreateTaskSchema), ctrl.createTask);
leadRouter.patch("/:id/tasks/:taskId/complete", ctrl.completeTask);
