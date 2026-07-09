/**
 * Shared processor for IMAP messages.
 * Called by both the poll worker (imap-poll.worker.ts) and the IDLE
 * service (imap-idle.service.ts) so the business logic lives in one place.
 *
 * Processing order for each message:
 *
 *  0. Bounce / system filter — mailer-daemon, postmaster, auto-reply, OOO
 *     → record the bounce against the original campaign contact, then skip.
 *
 *  Correlation strategies (attempted in order for real replies):
 *  1. reply+{campaignContactId}@domain  — exact alias routing
 *  2. In-Reply-To / References header match against email_events.message_id
 *  3. Sender email recency — recipient_email in email_events within 30 days
 *  Fallback: unassigned conversation (source="inbound_email") so nothing is dropped.
 */

import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../core/database";
import { logger } from "../../core/logger";
import { config } from "../../core/config";
import { handleInboundEmailReply } from "../../modules/inbox/inbox.service";

export interface ParsedImapMessage {
  from: string;
  to: string[];
  inReplyTo: string | null;
  /** Full References chain from the incoming message's own headers */
  references: string[];
  subject: string;
  text: string | null;
  /** Raw HTML body, if the message has an HTML part. */
  html: string | null;
  messageId: string | null;
}

/** Crude HTML→text fallback for messages with no text/plain part at all. */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Plain text if present, else derived from HTML, else null. */
function resolveBodyText(msg: ParsedImapMessage): string | null {
  if (msg.text) return msg.text.slice(0, 10_000);
  if (msg.html) return htmlToPlainText(msg.html).slice(0, 10_000);
  return null;
}

// ─── Bounce / system email detection ─────────────────────────────────────────

const BOUNCE_FROM_PREFIXES = [
  "mailer-daemon@",
  "postmaster@",
  "mail-daemon@",
  "mail-delivery-subsystem@",
  "delivery-failure@",
  "bounces@",
  "bounce@",
  "noreply@",
  "no-reply@",
  "donotreply@",
  "do-not-reply@",
];

const BOUNCE_SUBJECTS = [
  "message delivery failure",
  "delivery status notification",
  "delivery failure",
  "undeliverable",
  "mail delivery failed",
  "mail delivery failure",
  "returned mail",
  "failure notice",
  "auto-reply",
  "automatic reply",
  "out of office",
  "vacation",
];

function isBounceOrSystem(msg: ParsedImapMessage): boolean {
  const fromLower = msg.from.toLowerCase();
  const subjectLower = (msg.subject ?? "").toLowerCase();

  if (BOUNCE_FROM_PREFIXES.some((p) => fromLower.includes(p))) return true;
  if (BOUNCE_SUBJECTS.some((s) => subjectLower.includes(s))) return true;
  return false;
}

// ─── Recipient extraction from bounce body ────────────────────────────────────
//
// GoDaddy/secureserver.net bounce emails contain the original recipient in
// a variety of formats.  We try the most specific patterns first.

const RECIPIENT_PATTERNS: RegExp[] = [
  // RFC 3464 DSN headers (most reliable):
  //   Final-Recipient: rfc822; user@domain.com
  //   Original-Recipient: rfc822; user@domain.com
  /(?:Final-Recipient|Original-Recipient):\s*rfc822;\s*([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i,
  // GoDaddy prose patterns:
  //   "could not be delivered to: user@domain.com"
  //   "Message Delivery Failure: user@domain.com"
  /(?:could not be delivered to|delivery failed(?:\s+for)?|Message Delivery Failure)[\s:]+([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i,
  // Generic "To: user@domain.com" line anywhere in the bounce body
  /^To:\s*([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/im,
];

function extractBouncedRecipient(body: string): string | null {
  for (const pattern of RECIPIENT_PATTERNS) {
    const m = body.match(pattern);
    if (m?.[1]) return m[1].toLowerCase();
  }
  return null;
}

// ─── Bounce recording ─────────────────────────────────────────────────────────

async function recordBounce(
  db: ReturnType<typeof getDb>,
  msg: ParsedImapMessage
): Promise<void> {
  const body = msg.text ?? "";
  const bouncedEmail = extractBouncedRecipient(body);
  const bounceReason = (msg.subject ?? "Delivery failure").slice(0, 500);

  if (!bouncedEmail) {
    logger.info("[imap-processor] bounce: could not extract recipient — recording as skip", {
      from: msg.from,
      subject: msg.subject,
      bodyPreview: body.slice(0, 300),
    });
    return;
  }

  const now = new Date();

  // Find the most recent campaign email sent to this address that hasn't
  // already been marked bounced.
  const event = await db("email_events")
    .where("recipient_email", bouncedEmail)
    .whereIn("event_type", ["sent", "delivered"])
    .orderBy("occurred_at", "desc")
    .first();

  if (!event) {
    logger.info("[imap-processor] bounce: no matching campaign event for recipient", {
      bouncedEmail,
    });
    return;
  }

  logger.info("[imap-processor] bounce: recording", {
    bouncedEmail,
    campaignId: event.campaign_id,
    campaignContactId: event.campaign_contact_id,
    orgId: event.organisation_id,
    bounceReason,
  });

  // 1. Update email_events: mark as bounced
  await db("email_events")
    .where("id", event.id as string)
    .update({ event_type: "bounced", occurred_at: now });

  // 2. Update campaign_contacts: mark as bounced
  if (event.campaign_contact_id) {
    await db("campaign_contacts")
      .where("id", event.campaign_contact_id as string)
      .update({
        status: "bounced",
        bounced_at: now,
        bounce_reason: bounceReason,
        updated_at: now,
      });
  }

  // 3. Increment campaign bounced_count
  if (event.campaign_id) {
    await db("campaigns")
      .where("id", event.campaign_id as string)
      .update({ bounced_count: db.raw("bounced_count + 1") });
  }
}

// ─── Main processor ───────────────────────────────────────────────────────────

/**
 * Process a batch of already-parsed IMAP messages.
 * Returns the number of messages that resulted in a conversation update or
 * bounce recording (i.e. were meaningfully handled — not skipped as dupes).
 *
 * @param fallbackOrgId  Org ID to use for unmatched emails.  When omitted the
 *                       processor tries config.imap.orgId, then resolves from
 *                       sender_identities by IMAP user email.
 */
export async function processInboundMessages(
  messages: ParsedImapMessage[],
  fallbackOrgId?: string | null
): Promise<number> {
  const db = getDb();
  const now = new Date();
  let processed = 0;

  // Resolve the fallback org once per batch (not per-message) to avoid
  // repeatedly querying sender_identities on large batches.
  let resolvedFallbackOrgId: string | null = fallbackOrgId ?? config.imap.orgId ?? null;

  if (!resolvedFallbackOrgId && config.imap.user) {
    const si = await db("sender_identities")
      .where("from_address", config.imap.user.toLowerCase())
      .where("channel", "email")
      .first();
    resolvedFallbackOrgId = (si?.organisation_id as string) ?? null;
    if (resolvedFallbackOrgId) {
      logger.info("[imap-processor] resolved fallback org from sender_identities", {
        orgId: resolvedFallbackOrgId,
        imapUser: config.imap.user,
      });
    }
  }

  for (const msg of messages) {
    // ── Per-message header dump ───────────────────────────────────────────
    logger.info("[imap-processor] processing message", {
      from: msg.from,
      to: msg.to,
      subject: msg.subject,
      inReplyTo: msg.inReplyTo,
      referencesCount: msg.references.length,
      messageId: msg.messageId,
    });

    // ── Step 0: bounce / system email filter ──────────────────────────────
    if (isBounceOrSystem(msg)) {
      logger.info("[imap-processor] bounce/system message detected — skipping conversation creation", {
        from: msg.from,
        subject: msg.subject,
        messageId: msg.messageId,
      });
      await recordBounce(db, msg);
      processed++; // count as handled so it doesn't reappear on reconnect
      continue;
    }

    // ── Strategy 1: reply+{campaignContactId}@domain ──────────────────────
    let campaignContactId: string | null = null;
    for (const toAddr of msg.to) {
      const match = toAddr.match(/^reply\+([a-f0-9-]{36})@/i);
      if (match) { campaignContactId = match[1]; break; }
    }

    let event: Record<string, unknown> | null = null;

    if (campaignContactId) {
      event = await db("email_events")
        .where("campaign_contact_id", campaignContactId)
        .orderBy("created_at", "desc")
        .first() ?? null;
    }

    logger.info("[imap-processor] strategy 1 (reply+ alias)", {
      matched: !!event,
      campaignContactId,
      eventId: event?.id ?? null,
    });

    // ── Strategy 2: In-Reply-To / References ──────────────────────────────
    if (!event) {
      const candidates = [msg.inReplyTo, ...msg.references].filter(
        (v): v is string => typeof v === "string" && v.length > 0
      );

      logger.info("[imap-processor] strategy 2 (In-Reply-To / References)", {
        candidateCount: candidates.length,
        candidates,
      });

      if (candidates.length > 0) {
        event = await db("email_events")
          .whereIn("message_id", candidates)
          .orderBy("created_at", "desc")
          .first() ?? null;
      }

      if (event) {
        logger.info("[imap-processor] strategy 2 matched", {
          eventId: event.id,
          matchedMessageId: event.message_id,
        });
      }
    }

    // ── Strategy 3: sender email recency (last 30 days) ───────────────────
    if (!event) {
      const fromLower = msg.from.toLowerCase();
      event = await db("email_events")
        .where("recipient_email", fromLower)
        .where("event_type", "sent")
        .where("occurred_at", ">=", new Date(Date.now() - 30 * 86_400_000))
        .orderBy("occurred_at", "desc")
        .first() ?? null;

      logger.info("[imap-processor] strategy 3 (email recency)", {
        fromEmail: fromLower,
        matched: !!event,
        eventId: event?.id ?? null,
        campaignId: event?.campaign_id ?? null,
        orgId: event?.organisation_id ?? null,
      });
    }

    // ── Correlation result log ────────────────────────────────────────────
    const strategyUsed: "1" | "2" | "3" | "none" = event
      ? campaignContactId && event ? "1" : msg.inReplyTo && event ? "2" : "3"
      : "none";

    logger.info("[imap-processor] correlation result", {
      strategy: strategyUsed,
      matched: !!event,
      orgId: (event?.organisation_id as string) ?? resolvedFallbackOrgId ?? null,
      campaignId: event?.campaign_id ?? null,
    });

    // ── Unmatched: create unassigned conversation ─────────────────────────
    if (!event) {
      if (!resolvedFallbackOrgId) {
        logger.warn(
          "[imap-processor] no fallback org ID — cannot create conversation for unmatched email. " +
          "Set IMAP_ORG_ID in .env or add a sender_identity with from_address matching IMAP_USER.",
          { from: msg.from, subject: msg.subject }
        );
        continue;
      }

      logger.info("[imap-processor] unmatched — creating unassigned conversation", {
        from: msg.from,
        subject: msg.subject,
        orgId: resolvedFallbackOrgId,
      });

      await handleInboundEmailReply(db, {
        orgId: resolvedFallbackOrgId,
        campaignId: null,
        campaignContactId: null,
        leadId: null,
        senderIdentityId: null,
        fromEmail: msg.from,
        messageId: msg.messageId,
        inReplyTo: msg.inReplyTo,
        contactReferences: msg.references,
        subject: msg.subject,
        bodyText: resolveBodyText(msg),
        bodyHtml: msg.html,
        receivedAt: now,
        sourceOverride: "inbound_email",
        statusOverride: "open",
      });

      processed++;
      continue;
    }

    // ── Guard: skip already-replied events ────────────────────────────────
    if (event.event_type === "replied") {
      logger.debug("[imap-processor] already-processed reply ignored", {
        from: msg.from,
        eventId: event.id,
      });
      continue;
    }

    // ── Mark original email event as replied ──────────────────────────────
    await db("email_events")
      .where("id", event.id as string)
      .update({ event_type: "replied", replied_at: now });

    if (event.campaign_id) {
      await db("campaigns").where("id", event.campaign_id).update({
        replied_count: db.raw("replied_count + 1"),
      });
    }
    if (event.campaign_contact_id) {
      await db("campaign_contacts")
        .where("id", event.campaign_contact_id as string)
        .update({ replied_at: now });
    }

    // ── Enrich contact info ───────────────────────────────────────────────
    let contactName: string | null = null;
    let contactCompany: string | null = null;
    if (event.campaign_contact_id) {
      const cc = await db("campaign_contacts as cc")
        .leftJoin("uploaded_contacts as uc", "uc.id", "cc.uploaded_contact_id")
        .where("cc.id", event.campaign_contact_id as string)
        .select("uc.first_name", "uc.last_name", "uc.company")
        .first();
      if (cc) {
        contactName = [cc.first_name, cc.last_name].filter(Boolean).join(" ") || null;
        contactCompany = cc.company ?? null;
      }
    }

    // ── Create / update conversation (idempotent via DB unique index) ─────
    await handleInboundEmailReply(db, {
      orgId: event.organisation_id as string,
      campaignId: (event.campaign_id as string) ?? null,
      campaignContactId: (event.campaign_contact_id as string) ?? null,
      leadId: (event.lead_id as string) ?? null,
      senderIdentityId: (event.sender_identity_id as string) ?? null,
      fromEmail: msg.from,
      toEmail: msg.to[0] ?? null,
      messageId: msg.messageId,
      inReplyTo: msg.inReplyTo,
      contactReferences: msg.references,
      subject: msg.subject,
      bodyText: resolveBodyText(msg),
      bodyHtml: msg.html,
      receivedAt: now,
      contactName,
      contactCompany,
    });

    // ── Legacy lead_activities timeline ───────────────────────────────────
    if (event.lead_id) {
      const existing = await db("lead_activities")
        .where("lead_id", event.lead_id)
        .where("type", "email_reply")
        .whereRaw(`JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.messageId')) = ?`, [
          msg.messageId ?? "",
        ])
        .first();

      if (!existing) {
        await db("lead_activities").insert({
          id: uuidv4(),
          lead_id: event.lead_id,
          organisation_id: event.organisation_id,
          user_id: null,
          type: "email_reply",
          subject: `Email reply: ${msg.subject}`,
          body: msg.text ? msg.text.slice(0, 2_000) : null,
          metadata: JSON.stringify({
            from: msg.from,
            campaignId: event.campaign_id,
            messageId: msg.messageId,
          }),
          created_at: now,
        });
      }
      await db("leads").where("id", event.lead_id).update({ last_activity_at: now });
    }

    processed++;
  }

  return processed;
}
