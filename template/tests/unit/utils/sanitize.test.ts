import { describe, it, expect } from "vitest";
import { sanitizeString, sanitizeJsonInput } from "@utils/sanitize";

describe("sanitizeString", () => {
  it("strips script tags", () => {
    expect(sanitizeString("<script>alert(1)</script>")).toBe("");
  });

  it("strips tags but preserves inner text", () => {
    expect(sanitizeString("<b>hello</b>")).toBe("hello");
  });

  it("strips href attributes", () => {
    expect(sanitizeString('<a href="evil.com">click</a>')).toBe("click");
  });

  it("returns plain strings unchanged", () => {
    expect(sanitizeString("hello world")).toBe("hello world");
  });
});

describe("sanitizeJsonInput", () => {
  it("sanitizes string values inside objects", () => {
    const result = sanitizeJsonInput({ name: "<b>Alice</b>" }) as Record<string, unknown>;
    expect(result.name).toBe("Alice");
  });

  it("sanitizes string values inside arrays", () => {
    const result = sanitizeJsonInput(["<script>x</script>", "safe"]);
    expect(result).toEqual(["", "safe"]);
  });

  it("passes numbers through unchanged", () => {
    expect(sanitizeJsonInput(42)).toBe(42);
  });

  it("passes booleans through unchanged", () => {
    expect(sanitizeJsonInput(true)).toBe(true);
  });

  it("returns null and undefined as-is", () => {
    expect(sanitizeJsonInput(null)).toBeNull();
    expect(sanitizeJsonInput(undefined)).toBeUndefined();
  });

  it("recursively sanitizes nested object string values", () => {
    const input = { user: { bio: "<script>evil</script>" } };
    const result = sanitizeJsonInput(input) as typeof input;
    expect(result.user.bio).toBe("");
  });

  it("does not throw on objects nested deeper than 10 levels", () => {
    let deep: Record<string, unknown> = { val: "<b>bottom</b>" };
    for (let i = 0; i < 12; i++) deep = { child: deep };
    expect(() => sanitizeJsonInput(deep)).not.toThrow();
  });
});
