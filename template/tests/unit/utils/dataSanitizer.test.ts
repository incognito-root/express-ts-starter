import { describe, it, expect } from "vitest";
import { sanitizeData } from "@utils/dataSanitizer";

const SENSITIVE = ["password", "token", "secret", "authorization", "cookie"];

describe("sanitizeData", () => {
  it("redacts sensitive fields", () => {
    const result = sanitizeData({ password: "secret123", name: "Alice" }, SENSITIVE);
    expect(result.password).toBe("[REDACTED]");
    expect(result.name).toBe("Alice");
  });

  it("redacts fields case-insensitively", () => {
    const result = sanitizeData({ Authorization: "Bearer xyz" }, SENSITIVE);
    expect(result.Authorization).toBe("[REDACTED]");
  });

  it("redacts fields that partially match a sensitive keyword", () => {
    const result = sanitizeData({ accessToken: "abc123" }, SENSITIVE);
    expect(result.accessToken).toBe("[REDACTED]");
  });

  it("recursively sanitizes nested objects", () => {
    const result = sanitizeData(
      { user: { password: "leaked", id: "123" } },
      SENSITIVE
    );
    expect(result.user.password).toBe("[REDACTED]");
    expect(result.user.id).toBe("123");
  });

  it("sanitizes sensitive values inside arrays", () => {
    const result = sanitizeData(
      [{ password: "x" }, { name: "Bob" }],
      SENSITIVE
    );
    expect(result[0].password).toBe("[REDACTED]");
    expect(result[1].name).toBe("Bob");
  });

  it("does not throw on objects nested deeper than 10 levels", () => {
    let deep: Record<string, unknown> = { password: "bottom" };
    for (let i = 0; i < 12; i++) deep = { nested: deep };
    expect(() => sanitizeData(deep, SENSITIVE)).not.toThrow();
  });

  it("returns primitives untouched", () => {
    expect(sanitizeData("a string", SENSITIVE)).toBe("a string");
    expect(sanitizeData(42, SENSITIVE)).toBe(42);
    expect(sanitizeData(null, SENSITIVE)).toBeNull();
  });

  it("leaves non-sensitive fields unchanged", () => {
    const result = sanitizeData({ name: "Alice", age: 30 }, SENSITIVE);
    expect(result.name).toBe("Alice");
    expect(result.age).toBe(30);
  });
});
