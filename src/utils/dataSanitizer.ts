/**
 * Data Sanitizer
 *
 * Uses 'any' types because this utility must handle arbitrary data structures
 * for security sanitization (removing passwords, tokens, etc.) from logs and error responses.
 * The input data structure is unknown at compile time.
 */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
export const sanitizeData = (
  data: any,
  sensitiveFields: string[],
  _depth = 0
): any => {
  if (!data || _depth > 10) return data;

  if (typeof data === "object" && data !== null) {
    const sanitized = Array.isArray(data) ? [...data] : { ...data };

    for (const key of Object.keys(sanitized)) {
      if (
        sensitiveFields.some((field) =>
          key.toLowerCase().includes(field.toLowerCase())
        )
      ) {
        sanitized[key] = "[REDACTED]";
      } else if (
        typeof sanitized[key] === "object" &&
        sanitized[key] !== null
      ) {
        sanitized[key] = sanitizeData(
          sanitized[key],
          sensitiveFields,
          _depth + 1
        );
      }
    }

    return sanitized;
  }

  return data;
};
