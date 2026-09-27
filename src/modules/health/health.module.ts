import { Module } from "@nestjs/common";

import { MongoHealthIndicator } from "@/common/mongo/mongo-health.indicator";

import { HealthController } from "@/modules/health/health.controller";

/** Wires up the health check endpoint. */
@Module({
  controllers: [HealthController],
  providers: [MongoHealthIndicator],
})
export class HealthModule {}
