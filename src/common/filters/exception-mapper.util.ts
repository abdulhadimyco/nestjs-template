import { HttpException } from "@nestjs/common";

import { isAppError } from "@/common/errors/app.error";
import {
  ErrorCode,
  HTTP_STATUS_TO_ERROR_CODE,
} from "@/common/errors/error-codes.constants";
import type { ErrorResponseBody } from "@/common/errors/error-response.types";

const DEFAULT_ERROR_MESSAGE = "Internal server error";

/** The result of mapping a caught exception to an HTTP response. */
export type ExceptionMapping = {
  status: number;
  body: ErrorResponseBody;
};

/** The shape duck-typed to detect a `nestjs-zod` validation exception. */
type ZodValidationExceptionLike = {
  getZodError: () => { issues: unknown[] };
};

/**
 * Maps any caught exception to the HTTP status and response body the client
 * should receive. Never leaks internal error details for unrecognised
 * exceptions.
 *
 * @param exception - The value caught by the global exception filter.
 * @param requestId - The current request's id, echoed back to the client.
 * @returns The status and body to send in the response.
 */
export function mapExceptionToResponse(
  exception: unknown,
  requestId: string,
): ExceptionMapping {
  if (isAppError(exception)) {
    return {
      status: exception.status,
      body: {
        code: exception.code,
        message: exception.message,
        details: exception.details,
        requestId,
      },
    };
  }

  if (isZodValidationException(exception)) {
    return {
      status: 400,
      body: {
        code: ErrorCode.VALIDATION_FAILED,
        message: "Validation failed",
        details: exception.getZodError().issues,
        requestId,
      },
    };
  }

  if (exception instanceof HttpException) {
    return mapHttpException(exception, requestId);
  }

  return {
    status: 500,
    body: {
      code: ErrorCode.INTERNAL,
      message: DEFAULT_ERROR_MESSAGE,
      requestId,
    },
  };
}

/**
 * Maps a Nest {@link HttpException} to the response shape.
 *
 * @param exception - The Nest exception to map.
 * @param requestId - The current request's id, echoed back to the client.
 * @returns The status and body to send in the response.
 */
function mapHttpException(
  exception: HttpException,
  requestId: string,
): ExceptionMapping {
  const status = exception.getStatus();
  const code = HTTP_STATUS_TO_ERROR_CODE[status] ?? ErrorCode.INTERNAL;
  const response = exception.getResponse();
  const details = typeof response === "object" ? response : undefined;

  return {
    status,
    body: { code, message: exception.message, details, requestId },
  };
}

/**
 * Duck-types `value` as a `nestjs-zod` validation exception, without a hard
 * dependency on that package's types.
 *
 * @param value - The value to check.
 * @returns True when `value` exposes a `getZodError()` method.
 */
function isZodValidationException(
  value: unknown,
): value is ZodValidationExceptionLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "getZodError" in value &&
    typeof value.getZodError === "function"
  );
}
