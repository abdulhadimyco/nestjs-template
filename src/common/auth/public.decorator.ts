import { SetMetadata } from "@nestjs/common";

import { AUTH_METADATA } from "@/common/auth/auth.constants";

/**
 * Marks a route (or controller) as not requiring authentication at all.
 * `JwtAuthGuard` allows the request through without inspecting the token.
 *
 * @returns A method/class decorator setting the public-route metadata.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention -- Nest decorators are conventionally PascalCase, matching @nestjs/common's own SetMetadata-based decorators.
export function Public(): ClassDecorator & MethodDecorator {
  return SetMetadata(AUTH_METADATA.IS_PUBLIC, true);
}
