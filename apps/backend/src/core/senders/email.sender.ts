import nodemailer from "nodemailer";
import { config } from "../config";
import { logger } from "../logger";

export interface SendEmailOptions {
  to: string;
  from: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  messageId: string | null;
  success: boolean;
  error?: string;
}

let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
      tls: { rejectUnauthorized: false },
    });
  }
  return _transporter;
}

export async function verifySmtpConnection(): Promise<boolean> {
  try {
    await getTransporter().verify();
    logger.info("[email-sender] SMTP connection verified");
    return true;
  } catch (err) {
    logger.error("[email-sender] SMTP verification failed", { err });
    return false;
  }
}

export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  try {
    const result = await getTransporter().sendMail({
      from: opts.from,
      to: opts.to,
      subject: opts.subject,
      html: opts.htmlBody,
      text: opts.textBody ?? "",
      replyTo: opts.replyTo,
    });
    logger.debug("[email-sender] sent", { to: opts.to, messageId: result.messageId });
    return { messageId: result.messageId ?? null, success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("[email-sender] failed", { to: opts.to, err: msg });
    return { messageId: null, success: false, error: msg };
  }
}
