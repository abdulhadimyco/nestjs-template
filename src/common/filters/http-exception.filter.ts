import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import { Catch } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";

import { mapExceptionToResponse } from "@/common/filters/exception-mapper.util";
import { AppLogger } from "@/common/logger/app-logger.service";
import { requestPath } from "@/common/utils/request-path.util";

/**
 * Global exception filter. Maps any thrown value to a stable JSON error
 * response and logs it: warn for 4xx, error for 5xx.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  /**
   * Creates the filter.
   *
   * @param logger - Logs the outcome of every caught exception.
   */
  constructor(private readonly logger: AppLogger) {}

  /**
   * Logs the outcome of an exception at the level appropriate to its status.
   *
   * @param status - The HTTP status the response was sent with.
   * @param requestId - The current request's id.
   * @param request - The current Fastify request.
   * @param exception - The value thrown during request handling.
   */
  private log(
    status: number,
    requestId: string,
    request: FastifyRequest,
    exception: unknown,
  ): void {
    const fields = {
      requestId,
      path: requestPath(request.url),
      method: request.method,
    };

    if (status >= 500) {
      this.logger.error("unhandled_exception", fields, exception);
      return;
    }

    this.logger.warn("handled_exception", fields);
  }

  /**
   * Handles a caught exception for the current request.
   *
   * @param exception - The value thrown during request handling.
   * @param host - The Nest arguments host for the current request.
   */
  public catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<FastifyRequest>();
    const reply = context.getResponse<FastifyReply>();
    const requestId = request.id;

    const { status, body } = mapExceptionToResponse(exception, requestId);

    this.log(status, requestId, request, exception);

    reply.status(status).send(body);
  }
}
