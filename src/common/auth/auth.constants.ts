/** Metadata keys used by the auth decorators/guards to mark route behaviour. */
export const AUTH_METADATA = {
  IS_PUBLIC: "auth:isPublic",
  IS_OPTIONAL: "auth:isOptional",
} as const;

/** The Cognito group name that grants admin privileges. */
export const AdminGroup = {
  ADMIN: "Admin",
} as const;

/**
 * Claim key names read off the decoded access token. Confirmed against
 * `authentication-api`'s `main` branch (`src/helpers/auth.ts:52-56`), which
 * signs every access token with `sub`, `preferred_username`,
 * `"myco:userid"`, and `"cognito:groups": [user.group]` — these names are
 * the live contract even though Cognito itself is retired. Do not rename
 * them without coordinating that change with `authentication-api`.
 */
export const AccessTokenClaimKey = {
  USER_ID: "myco:userid",
  GROUPS: "cognito:groups",
} as const;

/** The HTTP header carrying the bearer access token. */
export const AUTH_HEADER = "authorization";

/** The prefix preceding the token value in the `Authorization` header. */
export const BEARER_PREFIX = "Bearer ";
