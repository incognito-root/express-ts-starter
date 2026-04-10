import { vi, describe, it, expect, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  mockGet,
  mockSet,
  mockDel,
  mockConnect,
} = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockSet: vi.fn(),
  mockDel: vi.fn(),
  mockConnect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@utils/redis/redisClient", () => ({
  default: {
    getClient: vi.fn(() => ({
      get: mockGet,
      set: mockSet,
      del: mockDel,
    })),
    connect: mockConnect,
  },
}));

vi.mock("@utils/logger", () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

// ─── Subject under test ───────────────────────────────────────────────────────

import { idempotency } from "@middlewares/Idempotency";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_KEY = "550e8400-e29b-41d4-a716-446655440000";

function mockReq(key?: string): Request {
  return {
    headers: key ? { "idempotency-key": key } : {},
  } as unknown as Request;
}

function mockRes(): Response & { _status: number; _body: unknown; _headers: Record<string, string> } {
  const res = {
    _status: 200,
    _body: undefined as unknown,
    _headers: {} as Record<string, string>,
    statusCode: 200,
    status(code: number) { this.statusCode = code; this._status = code; return this; },
    json(body: unknown) { this._body = body; return this; },
    setHeader(name: string, value: string) { this._headers[name] = value; return this; },
  };
  return res as unknown as Response & { _status: number; _body: unknown; _headers: Record<string, string> };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("idempotency middleware", () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
    vi.clearAllMocks();
    mockConnect.mockResolvedValue(undefined);
  });

  it("calls next() immediately when no Idempotency-Key header is present", async () => {
    const req = mockReq();
    idempotency(req, mockRes(), next);
    // next is synchronous for the no-key path
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("returns 400 for an invalid (non-UUID) key", async () => {
    const req = mockReq("not-a-uuid");
    const res = mockRes();
    idempotency(req, res, next);
    expect(res._status).toBe(400);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 409 when a concurrent request owns the lock", async () => {
    mockSet.mockResolvedValue(null); // NX failed — key already exists
    mockGet.mockResolvedValue("PROCESSING");

    const req = mockReq(VALID_KEY);
    const res = mockRes();
    idempotency(req, res, next);

    await vi.waitFor(() => expect(res._status).toBe(409));
    expect(next).not.toHaveBeenCalled();
  });

  it("replays the cached response when the key has been seen before", async () => {
    const cached = JSON.stringify({ status: 201, body: { id: "abc" } });
    mockSet.mockResolvedValue(null); // NX failed
    mockGet.mockResolvedValue(cached);

    const req = mockReq(VALID_KEY);
    const res = mockRes();
    idempotency(req, res, next);

    await vi.waitFor(() => expect(res._status).toBe(201));
    expect((res as unknown as { _headers: Record<string, string> })._headers["Idempotency-Replayed"]).toBe("true");
    expect(next).not.toHaveBeenCalled();
  });

  it("acquires lock and calls next() on the first request", async () => {
    mockSet.mockResolvedValue("OK"); // NX succeeded

    const req = mockReq(VALID_KEY);
    idempotency(req, mockRes(), next);

    await vi.waitFor(() => expect(next).toHaveBeenCalledTimes(1));
  });

  it("caches the response when the handler returns 2xx", async () => {
    mockSet.mockResolvedValue("OK");

    const req = mockReq(VALID_KEY);
    const res = mockRes();
    idempotency(req, res, next);

    await vi.waitFor(() => expect(next).toHaveBeenCalled());

    // Simulate the handler calling res.json with a 201
    res.statusCode = 201;
    res.json({ id: "123" });

    expect(mockSet).toHaveBeenCalledTimes(2); // once for lock, once for caching
    const cacheCall = mockSet.mock.calls[1] as [string, string, { EX: number }];
    expect(JSON.parse(cacheCall[1])).toEqual({ status: 201, body: { id: "123" } });
  });

  it("releases the lock when the handler returns an error status", async () => {
    mockSet.mockResolvedValue("OK");
    mockDel.mockResolvedValue(1);

    const req = mockReq(VALID_KEY);
    const res = mockRes();
    idempotency(req, res, next);

    await vi.waitFor(() => expect(next).toHaveBeenCalled());

    res.statusCode = 422;
    res.json({ error: "Validation failed" });

    expect(mockDel).toHaveBeenCalled();
  });

  it("calls next() (fail open) when Redis is unavailable", async () => {
    mockConnect.mockRejectedValue(new Error("Redis down"));

    const req = mockReq(VALID_KEY);
    idempotency(req, mockRes(), next);

    await vi.waitFor(() => expect(next).toHaveBeenCalledTimes(1));
  });
});
