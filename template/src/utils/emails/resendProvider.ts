import { Resend } from "resend";

import { getEnv } from "../../config/env";
import { InternalServerError } from "../../errors/InternalServerError";
import { EmailOptions, EmailProvider } from "../../types";
import logger from "../logger";

export class ResendProvider implements EmailProvider {
  private readonly client: Resend;

  constructor() {
    const env = getEnv();
    const apiKey = env.RESEND_API_KEY;

    if (!apiKey) {
      throw new InternalServerError(
        "RESEND_API_KEY is required when EMAIL_PROVIDER is set to resend."
      );
    }

    this.client = new Resend(apiKey);
  }

  async sendMail(options: EmailOptions): Promise<void> {
    try {
      logger.debug("Attempting to send email", {
        provider: "resend",
        to: options.to,
        from: options.from,
        subject: options.subject,
      });

      const { data, error } = await this.client.emails.send({
        from: options.from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments?.map((attachment) => ({
          filename: attachment.filename,
          content:
            typeof attachment.content === "string"
              ? attachment.content
              : attachment.content.toString(attachment.encoding ?? "base64"),
        })),
      });

      if (error) {
        throw new InternalServerError("Resend API returned an error.", {
          cause: new Error(error.message),
        });
      }

      logger.info("Email sent successfully", {
        provider: "resend",
        to: options.to,
        subject: options.subject,
        messageId: data?.id,
      });
    } catch (error) {
      logger.error("Failed to send email", {
        provider: "resend",
        to: options.to,
        subject: options.subject,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }
}
