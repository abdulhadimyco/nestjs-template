import {
  Controller,
  Get,
  HttpStatus,
  Res,
  VERSION_NEUTRAL,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";

import { Public } from "@/common/auth/public.decorator";
import { MongoHealthIndicator } from "@/common/mongo/mongo-health.indicator";

/** The shape returned by the health check endpoint. */
type HealthStatus =
  { status: "ok"; mongo: "up" } | { status: "degraded"; mongo: "down" };

/**
 * Exposes the service's liveness endpoint. Public: load balancers carry no
 * token. Reports `200 { status: "ok" }` when Mongo is reachable, or
 * `503 { status: "degraded" }` when it is not — a load balancer or
 * orchestrator should stop routing traffic here in the latter case, so this
 * writes the status code directly rather than going through the exception
 * filter (which would reshape the body into the generic error envelope).
 */
@Public()
@Controller({ path: "healthz", version: VERSION_NEUTRAL })
export class HealthController {
  /**
   * Creates the controller.
   *
   * @param mongoHealth - Reports Mongo connectivity.
   */
  constructor(private readonly mongoHealth: MongoHealthIndicator) {}

  /**
   * Reports whether the service and its dependencies are up.
   *
   * @param reply - The Fastify reply, written to directly so the status
   * code can vary between `200` and `503`.
   */
  @Get()
  public check(@Res() reply: FastifyReply): void {
    const mongo = this.mongoHealth.check();
    const body: HealthStatus =
      mongo.status === "up"
        ? { status: "ok", mongo: "up" }
        : { status: "degraded", mongo: "down" };
    const httpStatus =
      mongo.status === "up" ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;

    reply.status(httpStatus).send(body);
  }
}
