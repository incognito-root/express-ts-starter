import { getEnv } from "../../config/env";
import { EmailProvider } from "../../types";

import { NodemailerProvider } from "./nodemailerProvider";
import { ResendProvider } from "./resendProvider";

export function createEmailProvider(): EmailProvider {
  const env = getEnv();

  if (env.EMAIL_PROVIDER === "resend") {
    return new ResendProvider();
  }

  return new NodemailerProvider();
}
