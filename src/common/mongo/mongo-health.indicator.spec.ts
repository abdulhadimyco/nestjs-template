import type { Connection } from "mongoose";
import { ConnectionStates } from "mongoose";

import { MongoHealthIndicator } from "@/common/mongo/mongo-health.indicator";

function fakeConnection(readyState: ConnectionStates): Connection {
  return { readyState } as unknown as Connection;
}

describe("MongoHealthIndicator", () => {
  it("reports up when the connection is connected", () => {
    const indicator = new MongoHealthIndicator(
      fakeConnection(ConnectionStates.connected),
    );

    expect(indicator.check()).toEqual({ status: "up" });
  });

  it("reports down for any other readyState", () => {
    const indicator = new MongoHealthIndicator(
      fakeConnection(ConnectionStates.disconnected),
    );

    expect(indicator.check()).toEqual({ status: "down" });
  });
});
