import type { FastifyRequest } from "fastify";
import { z } from "zod";

/**
 * Zod schema for the decoded HS256 access token issued by the Myco
 * authentication service. Validated in {@link TokenService.verify} after
 * signature verification, so a well-signed token with an unexpected shape
 * (missing `sub`, a scalar `cognito:groups`, ...) is rejected rather than
 * silently trusted.
 *
 * Confirmed against `authentication-api`'s `main` branch
 * (`src/helpers/auth.ts:52-56`): every issued access token carries `sub`,
 * `preferred_username`, `"myco:userid"`, and `"cognito:groups"` as a
 * `string[]` (`[user.group]`) — these are the live claim names and shapes
 * even though Cognito itself is retired. Do not rename them without
 * coordinating that change with `authentication-api`.
 */
export const accessTokenClaimsSchema = z.object({
  sub: z.string().min(1),
  exp: z.number(),
  iat: z.number(),
  iss: z.string().optional(),
  aud: z.string().optional(),
  "myco:userid": z.string().optional(),
  username: z.string().optional(),
  preferred_username: z.string().optional(),
  "cognito:groups": z.array(z.string()).optional(),
});

/**
 * The shape of the decoded HS256 access token issued by the Myco
 * authentication service.
 */
export type AccessTokenClaims = z.infer<typeof accessTokenClaimsSchema>;

/** The normalized identity attached to an authenticated request. */
export type AuthUser = {
  userId: string;
  username?: string;
  groups: readonly string[];
  isAdmin: boolean;
  claims: AccessTokenClaims;
};

/**
 * A Fastify request carrying the resolved identity, set by the
 * `JwtAuthGuard`.
 */
export type RequestWithAuth = FastifyRequest & {
  auth?: AuthUser;
};
