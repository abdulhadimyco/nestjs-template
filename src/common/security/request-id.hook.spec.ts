import type { FastifyReply, FastifyRequest } from "fastify";

import { createRequestIdHook } from "@/common/security/request-id.hook";

describe("createRequestIdHook", () => {
  it("echoes request.id as the x-request-id response header", done => {
    const hook = createRequestIdHook();
    // Test double: only `id` is read by this hook, casting past the rest of
    // FastifyRequest's large interface.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const request = { id: "req-123" } as FastifyRequest;
    const header = jest.fn();
    const reply = { header } as unknown as FastifyReply;

    // The hook's `this` is a FastifyInstance at runtime; unused in this hook,
    // so a plain call site is fine for the test.
    hook.call(undefined as never, request, reply, () => {
      expect(header).toHaveBeenCalledWith("x-request-id", "req-123");
      done();
    });
  });
});
