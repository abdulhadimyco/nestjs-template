import { SetMetadata } from "@nestjs/common";

import { AUTH_METADATA } from "@/common/auth/auth.constants";

/**
 * Marks a route (or controller) as accepting requests both with and
 * without a valid access token. When present and valid, the token is
 * still verified and `request.auth` populated; otherwise the request
 * proceeds with `request.auth` left `undefined`.
 *
 * @returns A method/class decorator setting the optional-auth metadata.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention -- Nest decorators are conventionally PascalCase, matching @nestjs/common's own SetMetadata-based decorators.
export function OptionalAuth(): ClassDecorator & MethodDecorator {
  return SetMetadata(AUTH_METADATA.IS_OPTIONAL, true);
}
