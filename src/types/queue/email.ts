export interface VerificationEmailJob {
  userId: string;
  email: string;
  name: string;
  verificationToken: string;
}

export interface GenericEmailJob {
  to: string;
  subject: string;
  html: string;
}

export type EmailJobData = VerificationEmailJob | GenericEmailJob;
export type EmailJobName = "verification" | "generic";
