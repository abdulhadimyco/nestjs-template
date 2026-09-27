import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import type { FastifyReply } from "fastify";

import { MongoHealthIndicator } from "@/common/mongo/mongo-health.indicator";

import { HealthController } from "@/modules/health/health.controller";

type ReplyMock = { status: jest.Mock; send: jest.Mock };

function fakeReply(): FastifyReply {
  const reply: ReplyMock = { status: jest.fn(), send: jest.fn() };
  reply.status.mockReturnValue(reply);
  reply.send.mockReturnValue(reply);

  return reply as unknown as FastifyReply;
}

describe("HealthController", () => {
  let controller: HealthController;
  let mongoHealth: { check: jest.Mock };

  beforeEach(async () => {
    mongoHealth = { check: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: MongoHealthIndicator, useValue: mongoHealth }],
    }).compile();

    controller = module.get(HealthController);
  });

  it("returns 200 with an ok status when Mongo is up", () => {
    mongoHealth.check.mockReturnValue({ status: "up" });
    const reply = fakeReply();

    controller.check(reply);

    expect(reply.status).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({ status: "ok", mongo: "up" });
  });

  it("returns 503 with a degraded status when Mongo is down", () => {
    mongoHealth.check.mockReturnValue({ status: "down" });
    const reply = fakeReply();

    controller.check(reply);

    expect(reply.status).toHaveBeenCalledWith(503);
    expect(reply.send).toHaveBeenCalledWith({
      status: "degraded",
      mongo: "down",
    });
  });
});
