import { Router, Request, Response } from "express";
import { getDb } from "../../core/database";
import { logger } from "../../core/logger";

export const trackingRouter = Router();

// 1×1 transparent GIF
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

trackingRouter.get("/open", async (req: Request, res: Response) => {
  const { c } = req.query as { c?: string };

  res.setHeader("Content-Type", "image/gif");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.end(TRANSPARENT_GIF);

  if (!c) return;
  try {
    const db = getDb();
    const cc = await db("campaign_contacts").where("id", c).first();
    if (!cc) return;

    const now = new Date();
    await db("campaign_contacts").where("id", c).update({ opened_at: db.raw("COALESCE(opened_at, ?)", [now]) });
    await db("campaigns")
      .where("id", cc.campaign_id)
      .update({ opened_count: db.raw("opened_count + 1") });

    await db("email_events")
      .where("campaign_contact_id", c)
      .where("event_type", "sent")
      .update({ event_type: "opened" });
  } catch (err) {
    logger.warn("[tracking] open error", { c, err });
  }
});

trackingRouter.get("/click", async (req: Request, res: Response) => {
  const { c, url } = req.query as { c?: string; url?: string };

  const target = url ? decodeURIComponent(url) : "/";

  if (c) {
    try {
      const db = getDb();
      const cc = await db("campaign_contacts").where("id", c).first();
      if (cc) {
        const now = new Date();
        await db("campaign_contacts").where("id", c).update({ clicked_at: db.raw("COALESCE(clicked_at, ?)", [now]) });
        await db("campaigns")
          .where("id", cc.campaign_id)
          .update({ clicked_count: db.raw("clicked_count + 1") });
      }
    } catch (err) {
      logger.warn("[tracking] click error", { c, err });
    }
  }

  res.redirect(302, target);
});

trackingRouter.get("/unsubscribe", async (req: Request, res: Response) => {
  const { c } = req.query as { c?: string };

  if (c) {
    try {
      const db = getDb();
      const cc = await db("campaign_contacts")
        .leftJoin("uploaded_contacts as uc", "uc.id", "campaign_contacts.uploaded_contact_id")
        .where("campaign_contacts.id", c)
        .select("campaign_contacts.*", "uc.email")
        .first();

      if (cc?.email) {
        const now = new Date();
        await db("suppression_list")
          .insert({
            id: require("crypto").randomUUID(),
            organisation_id: cc.organisation_id,
            type: "email",
            value: cc.email.toLowerCase(),
            reason: "unsubscribe",
            source: "user",
            created_at: now,
          })
          .onConflict(["organisation_id", "type", "value"])
          .ignore();

        await db("campaign_contacts").where("id", c).update({ unsubscribed_at: now });
        await db("campaigns").where("id", cc.campaign_id).update({
          unsubscribed_count: db.raw("unsubscribed_count + 1"),
        });
      }
    } catch (err) {
      logger.warn("[tracking] unsubscribe error", { c, err });
    }
  }

  res.send(`
    <!DOCTYPE html>
    <html><head><title>Unsubscribed</title></head>
    <body style="font-family:sans-serif;text-align:center;padding:60px">
      <h2>You've been unsubscribed.</h2>
      <p>You will no longer receive emails from this sender.</p>
    </body></html>
  `);
});
