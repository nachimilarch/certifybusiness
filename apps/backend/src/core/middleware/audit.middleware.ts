import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../database";
import { logger } from "../logger";

interface AuditOptions {
  action: string;
  resourceType?: string;
  /** Extract resource id from req — defaults to req.params.id */
  getResourceId?: (req: Request) => string | undefined;
  /** Capture old value before handler runs */
  captureOld?: (req: Request) => Promise<unknown>;
}

export function audit(opts: AuditOptions) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    // Attach audit context to res.locals so the route handler can enrich it
    _res.locals.audit = {
      action: opts.action,
      resourceType: opts.resourceType,
      resourceId: opts.getResourceId ? opts.getResourceId(req) : req.params.id,
      oldValue: opts.captureOld ? await opts.captureOld(req).catch(() => null) : null,
    };
    next();
  };
}

export async function writeAuditLog(
  req: Request,
  action: string,
  resourceType: string,
  resourceId: string | undefined,
  oldValue?: unknown,
  newValue?: unknown
): Promise<void> {
  if (!req.user) return;
  // Tell auditMutations() (below) this request already has a hand-written,
  // richer log entry — skip the generic fallback so it isn't logged twice.
  (req as Request & { _auditLogged?: boolean })._auditLogged = true;
  try {
    await getDb()("audit_logs").insert({
      id: uuidv4(),
      organisation_id: req.user.organisationId,
      user_id: req.user.id,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      old_value: oldValue ? JSON.stringify(oldValue) : null,
      new_value: newValue ? JSON.stringify(newValue) : null,
      ip_address: req.ip,
      user_agent: req.get("user-agent"),
      created_at: new Date(),
    });
  } catch (err) {
    logger.error("Failed to write audit log", { err });
  }
}

// ─── Generic fallback: catch every mutation not already hand-logged above ────
//
// writeAuditLog() above is called explicitly from a handful of controllers
// (auth, orgs, users, leads) and captures rich before/after diffs. Most
// mutating endpoints across the app (campaigns, calling, imports, channels,
// inbox, automation, teams, etc.) have no audit coverage at all. Rather than
// hand-adding writeAuditLog() to every one of those — easy to miss, and easy
// to forget on the next new endpoint — this middleware auto-logs any
// successful POST/PATCH/PUT/DELETE under /api/v1 that the handler didn't
// already log itself.

const MUTATING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

// Session/technical plumbing — not a business action worth auditing.
const EXCLUDED_PATH_SUFFIXES = ["/auth/refresh", "/auth/logout", "/inbox/stream-token"];

// Path segments that name a specific action rather than a plain CRUD verb,
// e.g. POST /campaigns/:id/launch -> "campaigns.launch" instead of "campaigns.create".
const SUBACTION_SEGMENTS = new Set([
  "launch", "pause", "resume", "approve", "reject", "reply", "assign",
  "close", "reopen", "test", "apply", "members",
]);

const METHOD_VERB: Record<string, string> = {
  POST: "create",
  PATCH: "update",
  PUT: "update",
  DELETE: "delete",
};

// Keys redacted wherever they appear in a logged request body — credentials,
// passwords, and tokens must never land in the audit trail in plain text.
const SENSITIVE_KEYS = new Set([
  "password", "credentials", "apikey", "apisecret", "token", "secret",
  "accesstoken", "refreshtoken", "currentpassword", "newpassword", "pass",
]);

function sanitizeBody(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => sanitizeBody(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? "[redacted]" : sanitizeBody(v, depth + 1);
    }
    return out;
  }
  return value;
}

function isIdLike(segment: string | undefined): boolean {
  return !!segment && segment.includes("-") && /^[0-9a-f-]{8,40}$/i.test(segment);
}

function deriveAction(req: Request): { action: string; resourceType: string; resourceId?: string } {
  const pathOnly = req.originalUrl.split("?")[0];
  const segments = pathOnly.split("/").filter(Boolean).slice(2); // drop "api", "v1"
  const resourceType = segments[0] ?? "unknown";
  const last = segments[segments.length - 1];

  const action = last && SUBACTION_SEGMENTS.has(last)
    ? `${resourceType}.${last}`
    : `${resourceType}.${METHOD_VERB[req.method] ?? req.method.toLowerCase()}`;

  const resourceId = req.params?.id ?? (isIdLike(last) ? last : undefined);
  return { action, resourceType, resourceId };
}

/** Mount once, globally, ahead of the route handlers. */
export function auditMutations() {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!MUTATING_METHODS.has(req.method) || !req.originalUrl.startsWith("/api/v1/")) {
      return next();
    }
    const pathOnly = req.originalUrl.split("?")[0];
    if (EXCLUDED_PATH_SUFFIXES.some((suffix) => pathOnly.endsWith(suffix))) {
      return next();
    }

    res.on("finish", () => {
      if ((req as Request & { _auditLogged?: boolean })._auditLogged) return;
      if (!req.user) return;
      if (res.statusCode < 200 || res.statusCode >= 300) return;

      const { action, resourceType, resourceId } = deriveAction(req);
      writeAuditLog(req, action, resourceType, resourceId, undefined, sanitizeBody(req.body)).catch(
        () => {}
      );
    });

    next();
  };
}
