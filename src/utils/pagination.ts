export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface PrismaPaginationOptions {
  skip: number;
  take: number;
  orderBy?: Record<string, "asc" | "desc">;
}

export class PaginationHelper {
  static readonly DEFAULT_PAGE = 1;
  static readonly DEFAULT_LIMIT = 20;
  static readonly MAX_LIMIT = 100;

  static validateParams(params: PaginationParams): {
    page: number;
    limit: number;
    sortBy?: string;
    sortOrder: "asc" | "desc";
  } {
    const page = Math.max(1, params.page || this.DEFAULT_PAGE);
    const limit = Math.min(
      Math.max(1, params.limit || this.DEFAULT_LIMIT),
      this.MAX_LIMIT
    );
    const sortOrder = params.sortOrder === "desc" ? "desc" : "asc";

    return {
      page,
      limit,
      sortBy: params.sortBy,
      sortOrder,
    };
  }

  static getPrismaOptions(params: PaginationParams): PrismaPaginationOptions {
    const validated = this.validateParams(params);
    const skip = (validated.page - 1) * validated.limit;

    const options: PrismaPaginationOptions = {
      skip,
      take: validated.limit,
    };

    if (validated.sortBy) {
      options.orderBy = {
        [validated.sortBy]: validated.sortOrder,
      };
    }

    return options;
  }

  static formatResponse<T>(
    data: T[],
    total: number,
    params: PaginationParams
  ): PaginatedResponse<T> {
    const validated = this.validateParams(params);
    const totalPages = Math.ceil(total / validated.limit);

    return {
      data,
      pagination: {
        page: validated.page,
        limit: validated.limit,
        total,
        totalPages,
        hasNext: validated.page < totalPages,
        hasPrev: validated.page > 1,
      },
    };
  }

  static sanitizeTake(take?: number): number {
    if (take === undefined || take === null) {
      return this.DEFAULT_LIMIT;
    }
    return Math.min(Math.max(1, take), this.MAX_LIMIT);
  }

  static sanitizeSkip(skip?: number): number {
    if (skip === undefined || skip === null) {
      return 0;
    }
    return Math.max(0, skip);
  }
}

// ─── Cursor-based pagination ──────────────────────────────────────────────────
// Scales to large datasets. Does not require a COUNT(*) query.
// Cursors are opaque base64-encoded IDs — never expose raw DB IDs in URLs.

export interface CursorPaginationParams {
  /** Opaque cursor from the previous response's `nextCursor`. Omit for the first page. */
  cursor?: string;
  limit?: number;
  sortOrder?: "asc" | "desc";
}

export interface CursorPaginatedResponse<T> {
  data: T[];
  pagination: {
    nextCursor: string | null;
    hasNext: boolean;
    limit: number;
  };
}

/**
 * Prisma options for cursor-based pagination.
 *
 * `cursorId` is the decoded ID value from `cursor`.
 * `cursorField` is the unique field name used as the cursor (default: "id").
 */
export interface PrismaCursorOptions {
  take: number;
  cursor?: Record<string, string>;
  /** Always 1 when a cursor is present. Skip the cursor row itself. */
  skip?: number;
  orderBy?: Record<string, "asc" | "desc">;
}

export class CursorPaginationHelper {
  static readonly DEFAULT_LIMIT = 20;
  static readonly MAX_LIMIT = 100;

  /** Encode a database ID into an opaque cursor string. */
  static encodeCursor(id: string): string {
    return Buffer.from(id, "utf8").toString("base64url");
  }

  /**
   * Decode an opaque cursor back to a database ID.
   * Returns `null` if the cursor is malformed — callers should treat this as
   * a missing cursor (i.e. first page).
   */
  static decodeCursor(cursor: string): string | null {
    // Reject strings containing characters outside the base64url alphabet.
    // Buffer.from silently skips invalid chars, so we validate first.
    if (cursor.length > 0 && !/^[A-Za-z0-9_-]+$/.test(cursor)) return null;
    try {
      const decoded = Buffer.from(cursor, "base64url").toString("utf8");
      return decoded.length > 0 ? decoded : null;
    } catch {
      return null;
    }
  }

  static validateParams(params: CursorPaginationParams): {
    cursorId: string | null;
    limit: number;
    sortOrder: "asc" | "desc";
  } {
    const limit = Math.min(
      Math.max(1, params.limit ?? this.DEFAULT_LIMIT),
      this.MAX_LIMIT
    );
    const sortOrder = params.sortOrder === "asc" ? "asc" : "desc";
    const cursorId = params.cursor ? this.decodeCursor(params.cursor) : null;

    return { cursorId, limit, sortOrder };
  }

  /**
   * Returns Prisma query options for cursor pagination.
   *
   * Uses the "N+1 trick": fetch one extra record to determine whether a next
   * page exists without a separate COUNT query.
   *
   * @param params  Incoming request params
   * @param cursorField  The unique Prisma field to use as the cursor (default: "id")
   * @param sortField  The field to order by (default: "createdAt").
   *                   Should be indexed. For stable ordering use a unique field
   *                   or combine with the cursor field.
   */
  static getPrismaOptions(
    params: CursorPaginationParams,
    cursorField = "id",
    sortField = "createdAt"
  ): PrismaCursorOptions {
    const { cursorId, limit, sortOrder } = this.validateParams(params);

    const options: PrismaCursorOptions = {
      take: limit + 1, // fetch one extra to detect hasNext
      orderBy: { [sortField]: sortOrder },
    };

    if (cursorId) {
      options.cursor = { [cursorField]: cursorId };
      options.skip = 1; // skip the cursor record itself
    }

    return options;
  }

  /**
   * Trim the extra record from the result set and build the response envelope.
   *
   * @param items  Raw results from Prisma (may contain N+1 items)
   * @param params  The original pagination params
   * @param getId  Function to extract the cursor field value from an item
   */
  static formatResponse<T>(
    items: T[],
    params: CursorPaginationParams,
    getId: (item: T) => string
  ): CursorPaginatedResponse<T> {
    const { limit } = this.validateParams(params);
    const hasNext = items.length > limit;
    const data = hasNext ? items.slice(0, limit) : items;
    const lastItem = data[data.length - 1];
    const nextCursor =
      hasNext && lastItem ? this.encodeCursor(getId(lastItem)) : null;

    return {
      data,
      pagination: {
        nextCursor,
        hasNext,
        limit,
      },
    };
  }
}

