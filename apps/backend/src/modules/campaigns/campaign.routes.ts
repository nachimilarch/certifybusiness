import { Router } from "express";
import { authenticate } from "../../core/middleware/auth.middleware";
import { requirePermission } from "../../core/middleware/rbac.middleware";
import * as ctrl from "./campaign.controller";

export const campaignRouter = Router();
campaignRouter.use(authenticate);

campaignRouter.get("/", ctrl.listCampaigns);
campaignRouter.get("/:id", ctrl.getCampaign);
campaignRouter.post("/", ctrl.createCampaign);
campaignRouter.patch("/:id", ctrl.updateCampaign);
campaignRouter.delete("/:id", ctrl.deleteCampaign);

// Lifecycle actions
campaignRouter.post("/:id/launch", ctrl.launchCampaign);
campaignRouter.post("/:id/pause", ctrl.pauseCampaign);
campaignRouter.post("/:id/resume", ctrl.resumeCampaign);
