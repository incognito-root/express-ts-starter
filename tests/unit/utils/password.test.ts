import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@utils/password";

describe("hashPassword", () => {
  it("returns a bcrypt hash for a valid password", async () => {
    const hash = await hashPassword("SecurePass123!");
    expect(hash).toMatch(/^\$2[ab]\$\d+\$/);
  });

  it("accepts a password at exactly 72 bytes (UTF-8 boundary)", async () => {
    const pwd72 = "a".repeat(72); // 72 ASCII chars = 72 bytes
    await expect(hashPassword(pwd72)).resolves.toBeDefined();
  });

  it("throws when password exceeds 72 bytes", () => {
    const pwd73 = "a".repeat(73);
    expect(() => hashPassword(pwd73)).toThrow(
      "Password exceeds maximum allowed length"
    );
  });

  it("throws for multi-byte characters that push past 72 bytes", () => {
    // Each '€' is 3 bytes in UTF-8 — 25 of them = 75 bytes
    const longMultibyte = "€".repeat(25);
    expect(() => hashPassword(longMultibyte)).toThrow(
      "Password exceeds maximum allowed length"
    );
  });
});

describe("verifyPassword", () => {
  it("returns true for a matching password", async () => {
    const pwd = "SecurePass123!";
    const hash = await hashPassword(pwd);
    await expect(verifyPassword(pwd, hash)).resolves.toBe(true);
  });

  it("returns false for a wrong password", async () => {
    const hash = await hashPassword("SecurePass123!");
    await expect(verifyPassword("WrongPass456!", hash)).resolves.toBe(false);
  });

  it("throws when password exceeds 72 bytes", () => {
    const hash = "any-hash";
    const pwd73 = "a".repeat(73);
    expect(() => verifyPassword(pwd73, hash)).toThrow(
      "Password exceeds maximum allowed length"
    );
  });
});
