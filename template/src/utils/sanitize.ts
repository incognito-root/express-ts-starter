import DOMPurify from "isomorphic-dompurify";

export const sanitizeString = (input: string): string => {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
};

export const sanitizeJsonInput = <T>(input: T, _depth = 0): T => {
  if (!input || _depth > 10) return input;

  if (typeof input === "string") {
    return sanitizeString(input) as T;
  }

  if (typeof input === "number" || typeof input === "boolean") {
    return input;
  }

  if (Array.isArray(input)) {
    const sanitizedArray: unknown[] = input.map((item: unknown) =>
      sanitizeJsonInput(item, _depth + 1)
    );
    return sanitizedArray as T;
  }

  if (typeof input === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      const sanitizedKey = sanitizeString(key);
      sanitized[sanitizedKey] = sanitizeJsonInput(value, _depth + 1);
    }
    return sanitized as T;
  }

  return input;
};
