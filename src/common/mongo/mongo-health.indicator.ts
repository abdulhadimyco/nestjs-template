import { Injectable } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import type { Connection } from "mongoose";
import { ConnectionStates } from "mongoose";

/** Mongo connection status as reported by {@link MongoHealthIndicator}. */
export type MongoHealthStatus = {
  status: "up" | "down";
};

/**
 * Reports Mongo connectivity from the driver's own `readyState`, without
 * depending on `@nestjs/terminus`.
 */
@Injectable()
export class MongoHealthIndicator {
  /**
   * Creates the indicator.
   *
   * @param connection - The default Mongoose connection.
   */
  constructor(@InjectConnection() private readonly connection: Connection) {}

  /**
   * Checks whether the Mongo connection is ready.
   *
   * @returns `up` when connected, `down` otherwise.
   */
  public check(): MongoHealthStatus {
    return {
      status:
        this.connection.readyState === ConnectionStates.connected
          ? "up"
          : "down",
    };
  }
}
