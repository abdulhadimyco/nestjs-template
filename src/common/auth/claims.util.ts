import type { IncomingHttpHeaders } from "node:http";

import {
  AccessTokenClaimKey,
  AdminGroup,
  AUTH_HEADER,
  BEARER_PREFIX,
} from "@/common/auth/auth.constants";
import type { AccessTokenClaims, AuthUser } from "@/common/auth/auth.types";

/**
 * Normalizes decoded access token claims into the shape the rest of the
 * app consumes.
 *
 * @param claims - The verified, decoded access token claims.
 * @returns The normalized {@link AuthUser}.
 */
export function toAuthUser(claims: AccessTokenClaims): AuthUser {
  const userId = claims[AccessTokenClaimKey.USER_ID] ?? claims.sub;
  const username = claims.username ?? claims.preferred_username;
  const groups = claims[AccessTokenClaimKey.GROUPS] ?? [];

  return {
    userId,
    ...(username !== undefined ? { username } : {}),
    groups,
    isAdmin: groups.includes(AdminGroup.ADMIN),
    claims,
  };
}

/**
 * Extracts the bearer token from a set of request headers, tolerating a
 * differently-cased header name and surrounding whitespace.
 *
 * @param headers - The incoming request headers.
 * @returns The bearer token, or `undefined` when missing or malformed.
 */
export function extractBearerToken(
  headers: IncomingHttpHeaders,
): string | undefined {
  const headerKey = Object.keys(headers).find(
    key => key.toLowerCase() === AUTH_HEADER,
  );
  const rawValue = headerKey === undefined ? undefined : headers[headerKey];

  if (typeof rawValue !== "string") {
    return undefined;
  }

  if (!rawValue.startsWith(BEARER_PREFIX)) {
    return undefined;
  }

  const token = rawValue.slice(BEARER_PREFIX.length).trim();

  return token.length > 0 ? token : undefined;
}
