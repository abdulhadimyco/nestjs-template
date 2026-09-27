import { ErrorCode } from "@/common/errors/error-codes.constants";

/** Options accepted by {@link AppError} and its subclasses. */
export type AppErrorOptions = {
  details?: unknown;
  cause?: unknown;
};

/**
 * Base class for every application-thrown error that maps to a specific
 * HTTP status and {@link ErrorCode}.
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly status: number;
  public readonly details?: unknown;

  /**
   * Creates an application error.
   *
   * @param code - The stable error code.
   * @param status - The HTTP status this error maps to.
   * @param message - A human-readable message.
   * @param options - Optional structured details and/or an upstream cause.
   */
  constructor(
    code: ErrorCode,
    status: number,
    message: string,
    options?: AppErrorOptions,
  ) {
    super(
      message,
      options?.cause !== undefined ? { cause: options.cause } : undefined,
    );
    this.name = new.target.name;
    this.code = code;
    this.status = status;
    this.details = options?.details;
  }
}

/** A request failed input validation. Maps to HTTP 400. */
export class ValidationError extends AppError {
  /**
   * Creates a validation error.
   *
   * @param message - A human-readable message.
   * @param options - Optional structured details and/or an upstream cause.
   */
  constructor(message: string, options?: AppErrorOptions) {
    super(ErrorCode.VALIDATION_FAILED, 400, message, options);
  }
}

/** The caller is not authenticated. Maps to HTTP 401. */
export class UnauthorizedError extends AppError {
  /**
   * Creates an unauthorized error.
   *
   * @param message - A human-readable message.
   * @param options - Optional structured details and/or an upstream cause.
   */
  constructor(message: string, options?: AppErrorOptions) {
    super(ErrorCode.UNAUTHORIZED, 401, message, options);
  }
}

/** The caller is authenticated but not permitted. Maps to HTTP 403. */
export class ForbiddenError extends AppError {
  /**
   * Creates a forbidden error.
   *
   * @param message - A human-readable message.
   * @param options - Optional structured details and/or an upstream cause.
   */
  constructor(message: string, options?: AppErrorOptions) {
    super(ErrorCode.FORBIDDEN, 403, message, options);
  }
}

/** The requested resource does not exist. Maps to HTTP 404. */
export class NotFoundError extends AppError {
  /**
   * Creates a not-found error.
   *
   * @param message - A human-readable message.
   * @param options - Optional structured details and/or an upstream cause.
   */
  constructor(message: string, options?: AppErrorOptions) {
    super(ErrorCode.NOT_FOUND, 404, message, options);
  }
}

/** The request conflicts with existing state. Maps to HTTP 409. */
export class ConflictError extends AppError {
  /**
   * Creates a conflict error.
   *
   * @param message - A human-readable message.
   * @param options - Optional structured details and/or an upstream cause.
   */
  constructor(message: string, options?: AppErrorOptions) {
    super(ErrorCode.CONFLICT, 409, message, options);
  }
}

/** The caller has exceeded a rate limit. Maps to HTTP 429. */
export class RateLimitedError extends AppError {
  /**
   * Creates a rate-limited error.
   *
   * @param message - A human-readable message.
   * @param options - Optional structured details and/or an upstream cause.
   */
  constructor(message: string, options?: AppErrorOptions) {
    super(ErrorCode.RATE_LIMITED, 429, message, options);
  }
}

/** A call to an upstream dependency failed. Maps to HTTP 502. */
export class UpstreamError extends AppError {
  /**
   * Creates an upstream error.
   *
   * @param message - A human-readable message.
   * @param options - Optional structured details and/or an upstream cause.
   */
  constructor(message: string, options?: AppErrorOptions) {
    super(ErrorCode.UPSTREAM_FAILED, 502, message, options);
  }
}

/**
 * Narrows an unknown value to {@link AppError}.
 *
 * @param value - The value to check.
 * @returns True when `value` is an {@link AppError}.
 */
export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}
