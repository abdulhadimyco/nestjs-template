import type { ErrorCode } from "@/common/errors/error-codes.constants";

/** The JSON body returned to clients for every error response. */
export type ErrorResponseBody = {
  code: ErrorCode;
  message: string;
  details?: unknown;
  requestId: string;
};
