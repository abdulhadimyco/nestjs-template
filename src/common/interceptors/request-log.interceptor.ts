import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import type { Observable } from "rxjs";
import { catchError, tap, throwError } from "rxjs";

import type { RequestWithAuth } from "@/common/auth/auth.types";
import { AppLogger } from "@/common/logger/app-logger.service";
import { requestPath } from "@/common/utils/request-path.util";

/**
 * Logs one `http_request` line per request, on both success and error, with
 * the resolved status, duration, and caller when available.
 */
@Injectable()
export class RequestLogInterceptor implements NestInterceptor {
  /**
   * Creates the interceptor.
   *
   * @param logger - Logs one `http_request` line per completed request.
   */
  constructor(private readonly logger: AppLogger) {}

  /**
   * Emits the `http_request` log line for one completed request.
   *
   * @param request - The current request.
   * @param status - The resolved HTTP status.
   * @param startedAt - The timestamp the request started at, in ms.
   */
  private log(
    request: RequestWithAuth,
    status: number,
    startedAt: number,
  ): void {
    const userId = request.auth?.userId;

    this.logger.info("http_request", {
      requestId: request.id,
      method: request.method,
      path: requestPath(request.url),
      status,
      durationMs: Date.now() - startedAt,
      ...(userId !== undefined ? { userId } : {}),
    });
  }

  /**
   * Wraps the request pipeline to log its outcome.
   *
   * @param context - The current execution context.
   * @param next - The next handler in the pipeline.
   * @returns The unmodified observable returned by `next`.
   */
  public intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithAuth>();
    const reply = http.getResponse<FastifyReply>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        this.log(request, reply.statusCode, startedAt);
      }),
      catchError((error: unknown) => {
        this.log(request, resolveErrorStatus(error), startedAt);
        return throwError(() => error);
      }),
    );
  }
}

/**
 * Resolves the HTTP status to log for a thrown error.
 *
 * @param error - The error thrown by the request pipeline.
 * @returns The error's status, `getStatus()` result, or 500 as a fallback.
 */
function resolveErrorStatus(error: unknown): number {
  if (typeof error === "object" && error !== null) {
    if ("status" in error && typeof error.status === "number") {
      return error.status;
    }

    if ("getStatus" in error && typeof error.getStatus === "function") {
      return (error as { getStatus: () => number }).getStatus();
    }
  }

  return 500;
}
