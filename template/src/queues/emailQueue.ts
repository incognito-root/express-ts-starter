import { Queue, Worker } from "bullmq";

import { getEnv } from "../config/env";
import { ERROR_MESSAGES } from "../constants/errorMessages";
import { InternalServerError } from "../errors/InternalServerError";
import {
  EmailJobData,
  EmailJobName,
  GenericEmailJob,
  VerificationEmailJob,
} from "../types";
import { createEmailProvider } from "../utils/emails/emailProviderFactory";
import { EmailService } from "../utils/emails/emailService";
import logger from "../utils/logger";

const env = getEnv();

const redisConnection = {
  url: env.REDIS_URL,
};

export const emailQueue = new Queue("email", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 3600,
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600,
    },
  },
});

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- BullMQ Worker generics don't fully propagate to job properties */
export const emailWorker = new Worker<
  EmailJobData,
  { success: boolean },
  EmailJobName
>(
  "email",
  async (job) => {
    logger.info(`Processing email job: ${job.id}`, {
      jobId: job.id,
      type: job.name,
    });

    try {
      const emailProvider = createEmailProvider();
      const emailService = EmailService.getInstance(emailProvider);

      switch (job.name) {
        case "verification": {
          const verificationData = job.data as VerificationEmailJob;
          const verificationLink = `${env.FRONTEND_URL}/verify-email?token=${verificationData.verificationToken}`;

          await emailService.sendEmailVerificationEmail({
            to: verificationData.email,
            name: verificationData.name,
            verificationLink,
          });
          break;
        }

        case "generic": {
          const genericData = job.data as GenericEmailJob;
          await emailService.sendEmail({
            to: genericData.to,
            from: env.EMAIL_FROM,
            subject: genericData.subject,
            html: genericData.html,
          });
          break;
        }

        default: {
          const _exhaustiveCheck: never = job.name;
          throw new InternalServerError(ERROR_MESSAGES.UNKNOWN_EMAIL_JOB_TYPE);
        }
      }

      logger.info(`Email job completed: ${job.id}`);
      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error(`Email job failed: ${job.id}`, {
        error: errorMessage,
        stack: errorStack,
        jobName: job.name,
        jobData: job.data,
      });
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

emailWorker.on("completed", (job) => {
  logger.info(`Email job ${job.id} completed successfully`);
});

emailWorker.on("failed", (job, err) => {
  logger.error(`Email job ${job?.id} failed`, {
    error: err.message,
    stack: err.stack,
    attempts: job?.attemptsMade,
    jobName: job?.name,
  });
});
/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

export async function queueVerificationEmail(data: VerificationEmailJob) {
  return emailQueue.add("verification", data, {
    priority: 1,
  });
}

export async function queueGenericEmail(data: GenericEmailJob) {
  return emailQueue.add("generic", data);
}

export async function closeQueues() {
  await emailQueue.close();
  await emailWorker.close();
  logger.info("Email queue and worker closed");
}
