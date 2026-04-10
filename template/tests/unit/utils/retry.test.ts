import { vi, describe, it, expect, afterEach } from "vitest";

vi.mock("@utils/logger", () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { withRetry } from "@utils/retry";

// All tests pass baseDelayMs: 0 to avoid real waiting.
// No fake timers needed — sleep(0) resolves in the next microtask.

afterEach(() => {
  vi.restoreAllMocks();
});

describe("withRetry", () => {
  it("returns the result on the first successful attempt", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries and returns the result after a transient failure", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValue("ok");

    const result = await withRetry(fn, { baseDelayMs: 0, jitter: false });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting all attempts", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always fails"));
    await expect(
      withRetry(fn, { maxAttempts: 3, baseDelayMs: 0, jitter: false })
    ).rejects.toThrow("always fails");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("stops retrying immediately when shouldRetry returns false", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("permanent"));
    const shouldRetry = vi.fn().mockReturnValue(false);

    await expect(
      withRetry(fn, { maxAttempts: 5, baseDelayMs: 0, jitter: false, shouldRetry })
    ).rejects.toThrow("permanent");

    expect(fn).toHaveBeenCalledTimes(1);
    expect(shouldRetry).toHaveBeenCalledTimes(1);
  });

  it("passes the correct attempt number to shouldRetry", async () => {
    const captured: number[] = [];
    const fn = vi.fn().mockRejectedValue(new Error("x"));
    const shouldRetry = (_err: unknown, attempt: number) => {
      captured.push(attempt);
      return attempt < 2; // stop after attempt 2
    };

    await expect(
      withRetry(fn, { maxAttempts: 5, baseDelayMs: 0, jitter: false, shouldRetry })
    ).rejects.toThrow();

    // shouldRetry(err, 1) → true (retry), shouldRetry(err, 2) → false (stop)
    expect(captured).toEqual([1, 2]);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("respects maxAttempts default of 3", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    await expect(
      withRetry(fn, { baseDelayMs: 0, jitter: false })
    ).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
