import Imap from "imap";
import { simpleParser } from "mailparser";
import { Readable } from "stream";
import { config } from "../../core/config";
import { logger } from "../../core/logger";
import type { ParsedImapMessage } from "./imap-message.processor";
import { processInboundMessages } from "./imap-message.processor";

// ─── IMAP helpers (poll-mode only — IDLE uses imap-idle.service.ts) ───────────

function connectImap(): Promise<Imap> {
  return new Promise((resolve, reject) => {
    if (!config.imap.host || !config.imap.user || !config.imap.password) {
      reject(new Error("IMAP not configured"));
      return;
    }
    const imap = new Imap({
      user: config.imap.user!,
      password: config.imap.password!,
      host: config.imap.host!,
      port: config.imap.port,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    });
    imap.once("ready", () => resolve(imap));
    imap.once("error", reject);
    imap.connect();
  });
}

function openInbox(imap: Imap): Promise<Imap.Box> {
  return new Promise((resolve, reject) => {
    imap.openBox("INBOX", false, (err, box) => {
      if (err) reject(err);
      else resolve(box);
    });
  });
}

function searchUnseen(imap: Imap): Promise<number[]> {
  return new Promise((resolve, reject) => {
    imap.search(["UNSEEN"], (err, uids) => {
      if (err) reject(err);
      else resolve(uids ?? []);
    });
  });
}

function fetchMessages(imap: Imap, uids: number[]): Promise<ParsedImapMessage[]> {
  return new Promise((resolve, reject) => {
    if (uids.length === 0) { resolve([]); return; }
    const results: ParsedImapMessage[] = [];
    const pending: Promise<void>[] = [];
    const fetch = imap.fetch(uids, { bodies: "", markSeen: true });

    fetch.on("message", (msg) => {
      const chunks: Buffer[] = [];
      msg.on("body", (stream) => {
        stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      });

      const msgPromise = new Promise<void>((msgResolve) => {
        msg.once("end", async () => {
          try {
            const parsed = await simpleParser(Readable.from(Buffer.concat(chunks)));

            const refsRaw = parsed.references;
            const refs: string[] = Array.isArray(refsRaw)
              ? refsRaw
              : typeof refsRaw === "string"
              ? refsRaw.split(/\s+/).filter(Boolean)
              : [];

            const toAddresses: string[] = [];
            if (parsed.to) {
              const toArr = Array.isArray(parsed.to) ? parsed.to : [parsed.to];
              for (const addrObj of toArr) {
                if (addrObj && typeof addrObj === "object" && "value" in addrObj) {
                  for (const a of (addrObj as any).value) {
                    if (a.address) toAddresses.push(a.address as string);
                  }
                }
              }
            }

            results.push({
              from: parsed.from?.value?.[0]?.address ?? parsed.from?.text ?? "",
              to: toAddresses,
              inReplyTo: (parsed.inReplyTo ?? null) as string | null,
              references: refs,
              subject: parsed.subject ?? "",
              text: parsed.text ?? null,
              html: typeof parsed.html === "string" ? parsed.html : null,
              messageId: parsed.messageId ?? null,
            });
          } catch (parseErr) {
            logger.warn("[imap-poll] failed to parse message", { err: parseErr });
          } finally {
            msgResolve();
          }
        });
      });

      pending.push(msgPromise);
    });

    fetch.once("error", reject);
    fetch.once("end", () => {
      Promise.all(pending).then(() => resolve(results)).catch(reject);
    });
  });
}

// ─── Main poll function ────────────────────────────────────────────────────────

export async function pollImap(): Promise<void> {
  if (!config.imap.host) {
    logger.debug("[imap-poll] IMAP not configured, skipping");
    return;
  }

  let imap: Imap | null = null;
  try {
    imap = await connectImap();
    await openInbox(imap);
    const uids = await searchUnseen(imap);

    if (uids.length === 0) {
      logger.debug("[imap-poll] no unseen messages");
      return;
    }

    logger.info("[imap-poll] processing unseen messages", { count: uids.length });
    const messages = await fetchMessages(imap, uids);
    logger.info("[imap-poll] parsed messages", { parsed: messages.length, fetched: uids.length });
    const processed = await processInboundMessages(messages, config.imap.orgId ?? undefined);
    logger.info("[imap-poll] done", { processed, parsed: messages.length });
  } catch (err) {
    logger.error("[imap-poll] error", { err });
    throw err;
  } finally {
    if (imap) {
      try { imap.end(); } catch { /* ignore */ }
    }
  }
}
