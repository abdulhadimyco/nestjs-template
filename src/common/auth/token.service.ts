import { Injectable } from "@nestjs/common";
import jwt from "jsonwebtoken";

import { AppConfigService } from "@/config/app-config.service";
import type { AccessTokenClaims } from "@/common/auth/auth.types";
import { accessTokenClaimsSchema } from "@/common/auth/auth.types";
import { UnauthorizedError } from "@/common/errors/app.error";

/** Verifies and decodes Myco access tokens. */
@Injectable()
export class TokenService {
  /**
   * Creates the token service.
   *
   * @param appConfig - The app's typed configuration, providing the JWT
   * secret and optional issuer/audience.
   */
  constructor(private readonly appConfig: AppConfigService) {}

  /**
   * Verifies an access token's signature (HS256 only) and, when
   * configured, its issuer and audience.
   *
   * @param token - The raw JWT string.
   * @returns The decoded, verified claims.
   * @throws {UnauthorizedError} When the token is missing, malformed,
   * expired, wrongly signed, or fails issuer/audience checks.
   */
  public verify(token: string): AccessTokenClaims {
    const { secret, issuer, audience } = this.appConfig.jwt;

    try {
      const decoded = jwt.verify(token, secret, {
        algorithms: ["HS256"],
        ...(issuer !== undefined ? { issuer } : {}),
        ...(audience !== undefined ? { audience } : {}),
      });

      return parseAccessTokenClaims(decoded);
    } catch (error) {
      throw new UnauthorizedError("Invalid or expired access token", {
        cause: error,
      });
    }
  }
}

/**
 * Validates a decoded JWT payload against {@link accessTokenClaimsSchema},
 * rejecting both the legacy string-payload shape `jsonwebtoken` also
 * allows and a well-signed token whose claims don't match the expected
 * shape (missing `sub`, a scalar `cognito:groups`, ...).
 *
 * @param decoded - The value returned by `jsonwebtoken`'s verify call.
 * @returns The validated claims, typed as {@link AccessTokenClaims}.
 * @throws {Error} When the payload fails schema validation (caught and
 * rewrapped as {@link UnauthorizedError} by the caller).
 */
function parseAccessTokenClaims(
  decoded: string | jwt.JwtPayload,
): AccessTokenClaims {
  return accessTokenClaimsSchema.parse(decoded);
}
