import { vi, describe, it, expect, beforeEach } from "vitest";
import jwt from "jsonwebtoken";

// ─── Hoisted mock functions (safe to reference inside vi.mock() factories) ───

const {
  mockIsTokenBlacklisted,
  mockBlacklistToken,
  mockFindByToken,
  mockDeleteByToken,
  mockCreateToken,
  mockDeleteByUserIdAndType,
} = vi.hoisted(() => ({
  mockIsTokenBlacklisted: vi.fn().mockResolvedValue(false),
  mockBlacklistToken: vi.fn().mockResolvedValue(undefined),
  mockFindByToken: vi.fn(),
  mockDeleteByToken: vi.fn().mockResolvedValue({ count: 1 }),
  mockCreateToken: vi.fn().mockResolvedValue({}),
  mockDeleteByUserIdAndType: vi.fn().mockResolvedValue({}),
}));

// ─── Module mocks ─────────────────────────────────────────────────────────────

// Stub generated Prisma output — no `prisma generate` required in CI.
// Paths are relative to THIS file (tests/unit/services/) so ../../../ = project root.
vi.mock("../../../generated/prisma", () => ({
  Role: { SUPER_ADMIN: "SUPER_ADMIN", OWNER: "OWNER", ADMIN: "ADMIN", MANAGER: "MANAGER", MEMBER: "MEMBER" },
  TokenType: { REFRESH: "REFRESH", VERIFY_EMAIL: "VERIFY_EMAIL" },
}));

vi.mock("../../../generated/prisma/client", () => ({
  Role: { SUPER_ADMIN: "SUPER_ADMIN", OWNER: "OWNER", ADMIN: "ADMIN", MANAGER: "MANAGER", MEMBER: "MEMBER" },
  TokenType: { REFRESH: "REFRESH", VERIFY_EMAIL: "VERIFY_EMAIL" },
  AuthContext: { PLATFORM: "PLATFORM", ORGANIZATION: "ORGANIZATION" },
  Prisma: {
    TransactionIsolationLevel: { ReadCommitted: "ReadCommitted" },
    PrismaClientKnownRequestError: class extends Error {},
  },
  PrismaClient: vi.fn().mockImplementation(() => ({
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $transaction: vi.fn(),
  })),
}));

// Inline the secret — avoids any TDZ issues since vi.mock factories are hoisted
vi.mock("@config/env", () => ({
  getEnv: vi.fn(() => ({
    JWT_SECRET: "test-secret-that-is-at-least-32-chars!!",
    JWT_ACCESS_EXPIRY: "15m",
    JWT_REFRESH_EXPIRY: "7d",
  })),
}));

// Prevent pg.Pool initialization during module import
vi.mock("@utils/prismaClient", () => ({
  default: {
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $transaction: vi.fn().mockImplementation(async function(fn: (tx: unknown) => Promise<unknown>) {
      return fn({});
    }),
  },
}));

vi.mock("@utils/redis/tokenBlacklist", () => ({
  isTokenBlacklisted: mockIsTokenBlacklisted,
  blacklistToken: mockBlacklistToken,
}));

vi.mock("@repositories/TokenRepository", () => ({
  TokenRepository: class {
    findByToken = mockFindByToken;
    deleteByToken = mockDeleteByToken;
    createToken = mockCreateToken;
    deleteByUserIdAndType = mockDeleteByUserIdAndType;
  },
}));

vi.mock("@repositories/UserRepository", () => ({
  UserRepository: class {
    findByEmail = vi.fn();
    findById = vi.fn();
    findActiveById = vi.fn();
    updateVerificationStatus = vi.fn();
  },
}));

vi.mock("@repositories/BaseRepository", () => ({
  withTransaction: vi.fn().mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) => fn({})
  ),
}));

vi.mock("@services/userService", () => ({ getUser: vi.fn() }));
vi.mock("@utils/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@utils/auditLogger", () => ({ audit: vi.fn() }));
vi.mock("@queues/emailQueue", () => ({
  queueVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

// ─── Subject under test ───────────────────────────────────────────────────────

import {
  generateToken,
  validateToken,
  blacklistAccessToken,
} from "@services/authService";
import { TokenRevokedError } from "@errors/TokenRevokedError";
import { TokenExpiredError } from "@errors/TokenExpiredError";
import { UnauthorizedError } from "@errors/UnauthorizedError";

// The same secret used in the getEnv mock above
const TEST_SECRET = "test-secret-that-is-at-least-32-chars!!";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("generateToken", () => {
  it("embeds the correct tokenType in the payload", () => {
    const token = generateToken("u1", "a@b.com", "MEMBER" as never, "ACCESS", false);
    const decoded = jwt.decode(token) as Record<string, unknown>;
    expect(decoded.tokenType).toBe("ACCESS");
  });

  it("embeds a UUID v4 jti in every token", () => {
    const token = generateToken("u1", "a@b.com", "MEMBER" as never, "ACCESS", false);
    const decoded = jwt.decode(token) as Record<string, unknown>;
    expect(decoded.jti).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("generates a unique jti on every call", () => {
    const d1 = jwt.decode(
      generateToken("u1", "a@b.com", "MEMBER" as never, "ACCESS", false)
    ) as Record<string, unknown>;
    const d2 = jwt.decode(
      generateToken("u1", "a@b.com", "MEMBER" as never, "ACCESS", false)
    ) as Record<string, unknown>;
    expect(d1.jti).not.toBe(d2.jti);
  });

  it("sets REFRESH tokenType correctly", () => {
    const token = generateToken("u1", "a@b.com", "MEMBER" as never, "REFRESH", false);
    const decoded = jwt.decode(token) as Record<string, unknown>;
    expect(decoded.tokenType).toBe("REFRESH");
  });

  it("embeds the userId and email in the payload", () => {
    const token = generateToken("user-123", "test@example.com", "ADMIN" as never, "ACCESS", false);
    const decoded = jwt.decode(token) as Record<string, unknown>;
    expect(decoded.id).toBe("user-123");
    expect(decoded.email).toBe("test@example.com");
  });
});

describe("validateToken", () => {
  beforeEach(() => {
    mockIsTokenBlacklisted.mockResolvedValue(false);
    mockFindByToken.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
    });
  });

  it("returns the decoded payload for a valid ACCESS token", async () => {
    const token = generateToken("u1", "a@b.com", "MEMBER" as never, "ACCESS", false);
    const decoded = await validateToken(token, "ACCESS");
    expect(decoded.tokenType).toBe("ACCESS");
    expect(decoded.id).toBe("u1");
  });

  it("throws UnauthorizedError when tokenType does not match expected", async () => {
    // ACCESS token validated as REFRESH — should be rejected
    const token = generateToken("u1", "a@b.com", "MEMBER" as never, "ACCESS", false);
    await expect(validateToken(token, "REFRESH")).rejects.toBeInstanceOf(
      UnauthorizedError
    );
  });

  it("throws TokenRevokedError when jti is blacklisted", async () => {
    mockIsTokenBlacklisted.mockResolvedValue(true);
    const token = generateToken("u1", "a@b.com", "MEMBER" as never, "ACCESS", false);
    await expect(validateToken(token, "ACCESS")).rejects.toBeInstanceOf(
      TokenRevokedError
    );
  });

  it("throws TokenExpiredError for an expired token", async () => {
    const expiredToken = jwt.sign(
      {
        id: "u1",
        email: "a@b.com",
        role: "MEMBER",
        tokenType: "ACCESS",
        jti: "test-jti",
        rememberMe: false,
        exp: Math.floor(Date.now() / 1000) - 10,
      },
      TEST_SECRET
    );
    await expect(validateToken(expiredToken, "ACCESS")).rejects.toBeInstanceOf(
      TokenExpiredError
    );
  });

  it("queries the DB for REFRESH tokens", async () => {
    const token = generateToken("u1", "a@b.com", "MEMBER" as never, "REFRESH", false);
    await validateToken(token, "REFRESH");
    expect(mockFindByToken).toHaveBeenCalledWith(token);
  });

  it("throws TokenRevokedError when REFRESH token is not found in the DB", async () => {
    mockFindByToken.mockResolvedValue(null);
    const token = generateToken("u1", "a@b.com", "MEMBER" as never, "REFRESH", false);
    await expect(validateToken(token, "REFRESH")).rejects.toBeInstanceOf(
      TokenRevokedError
    );
  });

  it("throws UnauthorizedError for a tampered token signature", async () => {
    const token = generateToken("u1", "a@b.com", "MEMBER" as never, "ACCESS", false);
    const tampered = token.slice(0, -4) + "xxxx";
    await expect(validateToken(tampered, "ACCESS")).rejects.toBeInstanceOf(
      UnauthorizedError
    );
  });
});

describe("blacklistAccessToken", () => {
  it("resolves without throwing for a valid token", async () => {
    const token = generateToken("u1", "a@b.com", "MEMBER" as never, "ACCESS", false);
    await expect(blacklistAccessToken(token)).resolves.toBeUndefined();
  });

  it("resolves without throwing for a garbage string", async () => {
    await expect(blacklistAccessToken("not-a-jwt")).resolves.toBeUndefined();
  });

  it("calls blacklistToken with the jti when token has a valid jti and exp", async () => {
    const token = generateToken("u1", "a@b.com", "MEMBER" as never, "ACCESS", false);
    await blacklistAccessToken(token);
    expect(mockBlacklistToken).toHaveBeenCalled();
  });
});
