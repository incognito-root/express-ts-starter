import { vi } from "vitest";

export const emailQueue = {
  add: vi.fn().mockResolvedValue({ id: "mock-job-id" }),
  close: vi.fn().mockResolvedValue(undefined),
  getJobCounts: vi
    .fn()
    .mockResolvedValue({ active: 0, waiting: 0, failed: 0 }),
};

export const emailWorker = {
  close: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
};

export const queueVerificationEmail = vi
  .fn()
  .mockResolvedValue({ id: "mock-job-id" });
export const queueGenericEmail = vi
  .fn()
  .mockResolvedValue({ id: "mock-job-id" });
export const closeQueues = vi.fn().mockResolvedValue(undefined);
