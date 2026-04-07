export class ValidationError extends Error {
  readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function assertString(
  value: unknown,
  field: string,
  maxLength = 1000,
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`${field} must be a non-empty string`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new ValidationError(
      `${field} must be at most ${maxLength} characters`,
    );
  }
  return trimmed;
}

export function assertOptionalString(
  value: unknown,
  field: string,
  maxLength = 1000,
): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return assertString(value, field, maxLength);
}

export function assertArray(
  value: unknown,
  field: string,
  maxLength = 100,
): unknown[] {
  if (!Array.isArray(value)) {
    throw new ValidationError(`${field} must be an array`);
  }
  if (value.length > maxLength) {
    throw new ValidationError(`${field} must have at most ${maxLength} items`);
  }
  return value;
}

export function assertPositiveInt(
  value: unknown,
  field: string,
  max = 10000,
): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > max) {
    throw new ValidationError(`${field} must be a positive integer (max ${max})`);
  }
  return n;
}

export function assertEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new ValidationError(
      `${field} must be one of: ${allowed.join(", ")}`,
    );
  }
  return value as T;
}
