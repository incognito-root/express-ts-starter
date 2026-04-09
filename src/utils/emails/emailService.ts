import { getEnv } from "../../config/env";
import { ERROR_MESSAGES } from "../../constants/errorMessages";
import { InternalServerError } from "../../errors/InternalServerError";
import { EmailProvider, EmailOptions } from "../../types/";

import { getEmailTemplate } from "./emailTemplates";

class EmailService {
  private static instance: EmailService;
  private provider: EmailProvider;

  private constructor(provider: EmailProvider) {
    this.provider = provider;
  }

  public static getInstance(provider?: EmailProvider): EmailService {
    if (!EmailService.instance) {
      if (!provider) {
        throw new InternalServerError(ERROR_MESSAGES.PROVIDER_MUST_BE_SUPPLIED);
      }
      EmailService.instance = new EmailService(provider);
    }
    return EmailService.instance;
  }

  public async sendEmail(options: EmailOptions) {
    await this.provider.sendMail(options);
  }

  public setProvider(provider: EmailProvider): void {
    this.provider = provider;
  }

  public async sendEmailVerificationEmail(user: {
    to: string;
    name: string;
    verificationLink: string;
  }) {
    const htmlContent = getEmailTemplate("emailVerificationEmail", {
      name: user.name,
      link: user.verificationLink,
    });

    await this.sendEmail({
      to: user.to,
      from: getEnv().EMAIL_FROM,
      subject: "Email Verification",
      html: htmlContent,
    });
  }
}

export { EmailService };
