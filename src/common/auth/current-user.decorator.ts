import type { ExecutionContext } from "@nestjs/common";
import { createParamDecorator } from "@nestjs/common";

import type { AuthUser, RequestWithAuth } from "@/common/auth/auth.types";

/**
 * Reads the resolved identity off the current request. Extracted from the
 * `CurrentUser` decorator factory so it can be unit-tested directly.
 *
 * @param context - The current execution context.
 * @returns The current request's {@link AuthUser}, if any.
 */
export function resolveCurrentUser(
  context: ExecutionContext,
): AuthUser | undefined {
  const request = context.switchToHttp().getRequest<RequestWithAuth>();
  return request.auth;
}

/**
 * Injects the authenticated request's resolved identity, as set by
 * `JwtAuthGuard`. Resolves to `undefined` on public or unauthenticated
 * optional-auth routes.
 *
 * @returns A parameter decorator resolving to the current {@link AuthUser}.
 */
export const CurrentUser = createParamDecorator(
  // eslint-disable-next-line @typescript-eslint/naming-convention -- unused decorator-factory parameter required by Nest's ParamDecoratorFactory signature; underscore marks it unused for noUnusedParameters.
  (_data: unknown, context: ExecutionContext): AuthUser | undefined =>
    resolveCurrentUser(context),
);
