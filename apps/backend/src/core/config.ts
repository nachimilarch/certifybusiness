import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export const config = {
  env: optional("NODE_ENV", "development"),
  port: parseInt(optional("PORT", "4000"), 10),
  appUrl: optional("APP_URL", "http://localhost:4000"),
  frontendUrl: optional("FRONTEND_URL", "http://localhost:3000"),

  db: {
    host: optional("DB_HOST", "127.0.0.1"),
    port: parseInt(optional("DB_PORT", "3306"), 10),
    user: optional("DB_USER", "root"),
    password: optional("DB_PASSWORD", "Chintu@Milarch@2500"),
    name: optional("DB_NAME", "certifybusiness"),
  },

  redis: {
    url: optional("REDIS_URL", "redis://127.0.0.1:6379"),
  },

  jwt: {
    accessSecret:
      process.env.JWT_ACCESS_SECRET ||
      (process.env.NODE_ENV === "production"
        ? (() => { throw new Error("JWT_ACCESS_SECRET required in production"); })()
        : "dev-access-secret-not-for-production"),
    refreshSecret:
      process.env.JWT_REFRESH_SECRET ||
      (process.env.NODE_ENV === "production"
        ? (() => { throw new Error("JWT_REFRESH_SECRET required in production"); })()
        : "dev-refresh-secret-not-for-production"),
    accessExpiresIn: optional("JWT_ACCESS_EXPIRES_IN", "15m"),
    refreshExpiresIn: optional("JWT_REFRESH_EXPIRES_IN", "7d"),
  },

  encryption: {
    key:
      process.env.ENCRYPTION_KEY ||
      (process.env.NODE_ENV === "production"
        ? (() => { throw new Error("ENCRYPTION_KEY required in production"); })()
        : "devkey12345678901234567890123456"),
  },

  smtp: {
    host: optional("SMTP_HOST", "smtpout.secureserver.net"),
    port: parseInt(optional("SMTP_PORT", "465"), 10),
    secure: (process.env.SMTP_SECURE ?? "true") !== "false",
    user: optional("SMTP_USER", ""),
    pass: optional("SMTP_PASS", ""),
    fromName: optional("SMTP_FROM_NAME", "CertifyBusiness"),
    fromEmail: optional("SMTP_FROM_EMAIL", "info@certifybusiness.com"),
  },

  aws: {
    region: optional("AWS_REGION", "ap-south-1"),
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sesFromDefault: optional("SES_FROM_DEFAULT", "noreply@example.com"),
  },

  whatsapp: {
    appSecret: process.env.META_APP_SECRET,
    verifyToken: optional("META_VERIFY_TOKEN", "verify-token"),
    apiVersion: "v19.0",
    baseUrl: "https://graph.facebook.com",
  },

  sms: {
    provider: optional("SMS_PROVIDER", "exotel"),
    apiKey: process.env.SMS_API_KEY,
    apiSecret: process.env.SMS_API_SECRET,
    baseUrl: process.env.SMS_BASE_URL,
  },

  storage: {
    uploadDir: process.env.UPLOAD_DIR ||
      path.join(process.cwd(), "uploads"),
    exportDir: process.env.UPLOAD_DIR ||
      path.join(process.cwd(), "uploads"),
  },

  tracking: {
    domain: optional("TRACKING_DOMAIN", "track.localhost"),
  },

  imap: {
    host: process.env.IMAP_HOST,
    port: parseInt(optional("IMAP_PORT", "993"), 10),
    user: process.env.IMAP_USER,
    password: process.env.IMAP_PASSWORD,
    // Org ID to assign unmatched inbound emails to. If not set, the processor
    // falls back to a sender_identities lookup by IMAP_USER email.
    orgId: process.env.IMAP_ORG_ID ?? null,
    pollIntervalMs: parseInt(optional("REPLY_INBOX_POLL_INTERVAL_MS", "300000"), 10),
    // How often to re-enter IDLE (ms). RFC 2177 requires < 29 min. Default: 29 min minus a small buffer.
    idleRenewMs: parseInt(optional("IMAP_IDLE_RENEW_MS", "1740000"), 10),
    // Initial reconnect delay (ms) after a connection failure. Doubles on each failure, caps at 5 min.
    reconnectDelayMs: parseInt(optional("IMAP_RECONNECT_DELAY_MS", "5000"), 10),
    // "idle" keeps a persistent IMAP connection and reacts to push events.
    // "poll" fetches unseen messages on a fixed interval (default, safer for shared hosting).
    mode: (process.env.REPLY_INBOX_MODE ?? "poll") as "idle" | "poll",
  },

  logging: {
    level: optional("LOG_LEVEL", "info"),
    dir: optional("LOG_DIR", "/logs/"),
  },

  isProd: process.env.NODE_ENV === "production",
  isDev: process.env.NODE_ENV !== "production",
} as const;

export type Config = typeof config;
