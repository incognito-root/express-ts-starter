import { describe, it, expect } from "vitest";
import { CursorPaginationHelper } from "@utils/pagination";

describe("CursorPaginationHelper", () => {
  describe("encodeCursor / decodeCursor", () => {
    it("round-trips an ID through encode/decode", () => {
      const id = "clx1234abcdef";
      expect(CursorPaginationHelper.decodeCursor(CursorPaginationHelper.encodeCursor(id))).toBe(id);
    });

    it("produces a base64url string (no +, /, = padding)", () => {
      const encoded = CursorPaginationHelper.encodeCursor("some-id-123");
      expect(encoded).not.toContain("+");
      expect(encoded).not.toContain("/");
      expect(encoded).not.toContain("=");
    });

    it("returns null for a malformed cursor", () => {
      expect(CursorPaginationHelper.decodeCursor("!!!not-base64!!!")).toBeNull();
    });

    it("returns null for an empty decoded value", () => {
      // base64url('') === ''
      expect(CursorPaginationHelper.decodeCursor("")).toBeNull();
    });
  });

  describe("validateParams", () => {
    it("uses defaults when no params are provided", () => {
      const { limit, sortOrder, cursorId } = CursorPaginationHelper.validateParams({});
      expect(limit).toBe(20);
      expect(sortOrder).toBe("desc");
      expect(cursorId).toBeNull();
    });

    it("caps limit at MAX_LIMIT (100)", () => {
      const { limit } = CursorPaginationHelper.validateParams({ limit: 9999 });
      expect(limit).toBe(100);
    });

    it("floors limit at 1", () => {
      const { limit } = CursorPaginationHelper.validateParams({ limit: 0 });
      expect(limit).toBe(1);
    });

    it("decodes a valid cursor", () => {
      const encoded = CursorPaginationHelper.encodeCursor("item-id-42");
      const { cursorId } = CursorPaginationHelper.validateParams({ cursor: encoded });
      expect(cursorId).toBe("item-id-42");
    });

    it("returns null cursorId for a malformed cursor", () => {
      const { cursorId } = CursorPaginationHelper.validateParams({ cursor: "bad!" });
      expect(cursorId).toBeNull();
    });
  });

  describe("getPrismaOptions", () => {
    it("returns take N+1 on the first page (no cursor)", () => {
      const opts = CursorPaginationHelper.getPrismaOptions({ limit: 10 });
      expect(opts.take).toBe(11);
      expect(opts.cursor).toBeUndefined();
      expect(opts.skip).toBeUndefined();
    });

    it("includes cursor and skip: 1 on subsequent pages", () => {
      const cursor = CursorPaginationHelper.encodeCursor("id-abc");
      const opts = CursorPaginationHelper.getPrismaOptions({ limit: 10, cursor });
      expect(opts.take).toBe(11);
      expect(opts.cursor).toEqual({ id: "id-abc" });
      expect(opts.skip).toBe(1);
    });

    it("uses the provided cursorField and sortField", () => {
      const opts = CursorPaginationHelper.getPrismaOptions({}, "slug", "name");
      expect(opts.orderBy).toEqual({ name: "desc" });
    });

    it("uses the provided sortOrder", () => {
      const opts = CursorPaginationHelper.getPrismaOptions({ sortOrder: "asc" });
      expect(opts.orderBy).toEqual({ createdAt: "asc" });
    });
  });

  describe("formatResponse", () => {
    const getId = (item: { id: string }) => item.id;

    it("indicates hasNext = false when items ≤ limit", () => {
      const items = [{ id: "a" }, { id: "b" }];
      const result = CursorPaginationHelper.formatResponse(items, { limit: 5 }, getId);
      expect(result.pagination.hasNext).toBe(false);
      expect(result.pagination.nextCursor).toBeNull();
      expect(result.data).toHaveLength(2);
    });

    it("trims the extra item and sets nextCursor when hasNext = true", () => {
      // 11 items returned for a limit of 10 → hasNext is true
      const items = Array.from({ length: 11 }, (_, i) => ({ id: `id-${i}` }));
      const result = CursorPaginationHelper.formatResponse(items, { limit: 10 }, getId);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.data).toHaveLength(10);
      // nextCursor is the encoded ID of the last returned item (index 9)
      const decoded = CursorPaginationHelper.decodeCursor(result.pagination.nextCursor!);
      expect(decoded).toBe("id-9");
    });

    it("returns empty data and null nextCursor for an empty result", () => {
      const result = CursorPaginationHelper.formatResponse([], { limit: 10 }, getId);
      expect(result.data).toHaveLength(0);
      expect(result.pagination.nextCursor).toBeNull();
      expect(result.pagination.hasNext).toBe(false);
    });
  });
});
