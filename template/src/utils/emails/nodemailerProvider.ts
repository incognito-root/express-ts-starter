import nodemailer, { Transporter } from "nodemailer";

import { getEnv } from "../../config/env";
import { EmailOptions, EmailProvider } from "../../types";
import logger from "../logger";

interface MailSendResult {
  messageId?: string;
  accepted?: string[];
  rejected?: string[];
}

export class NodemailerProvider implements EmailProvider {
  private transporter: Transporter;

  constructor() {
    const env = getEnv();
    const host = env.EMAIL_HOST;
    const port = env.EMAIL_PORT;
    const secure = env.EMAIL_SECURE;
    const user = env.EMAIL_USER;
    const pass = env.EMAIL_PASSWORD;

    logger.debug("Initializing email transporter", {
      host,
      port,
      secure,
      user: user ? `${user.substring(0, 4)}...` : "undefined",
    });

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });
  }

  async sendMail(options: EmailOptions): Promise<void> {
    try {
      logger.debug("Attempting to send email", {
        to: options.to,
        from: options.from,
        subject: options.subject,
      });

      const info = (await this.transporter.sendMail({
        from: options.from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments,
      })) as MailSendResult;

      logger.info("Email sent successfully", {
        to: options.to,
        subject: options.subject,
        messageId: info.messageId,
      });
    } catch (error) {
      logger.error("Failed to send email", {
        to: options.to,
        subject: options.subject,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }
}
