import type { onRequestHookHandler } from "fastify";

/**
 * Fastify `onRequest` hook that echoes `request.id` back as the
 * `x-request-id` response header, so clients and the log line for a request
 * share one id.
 *
 * The incoming `x-request-id` header (if any) is already folded into
 * `request.id` by Fastify itself: `main.ts` constructs the `FastifyAdapter`
 * with `requestIdHeader: "x-request-id"`, so a caller-supplied id round-trips
 * unchanged and a missing one falls back to Fastify's generated id.
 *
 * @param request - The incoming Fastify request, carrying the resolved id.
 * @param reply - The outgoing Fastify reply, which gets the header set.
 * @param done - Callback signalling the hook has finished.
 */
const requestIdHook: onRequestHookHandler = (request, reply, done) => {
  reply.header("x-request-id", request.id);
  done();
};

/**
 * Creates the Fastify `onRequest` hook that echoes `request.id` back as the
 * `x-request-id` response header. See {@link requestIdHook} for the
 * behaviour.
 *
 * @returns The `onRequest` hook to register on the Fastify instance.
 */
export function createRequestIdHook(): onRequestHookHandler {
  return requestIdHook;
}
