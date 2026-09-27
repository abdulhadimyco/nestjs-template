import type { ExecutionContext } from "@nestjs/common";

import { AdminGuard } from "@/common/auth/admin.guard";
import type { AuthUser, RequestWithAuth } from "@/common/auth/auth.types";
import { ForbiddenError } from "@/common/errors/app.error";

/**
 * Builds a fake {@link ExecutionContext} exposing the given request.
 *
 * @param request - The fake request to expose via `switchToHttp`.
 * @returns A minimal {@link ExecutionContext} stand-in.
 */
function createContext(request: RequestWithAuth): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe("AdminGuard", () => {
  const guard = new AdminGuard();

  it("allows a request whose auth is an admin", () => {
    const auth: AuthUser = {
      userId: "user-1",
      groups: [],
      isAdmin: true,
      claims: { sub: "user-1", exp: 1, iat: 1 },
    };
    const request: RequestWithAuth = { auth } as unknown as RequestWithAuth;

    expect(guard.canActivate(createContext(request))).toBe(true);
  });

  it("throws when auth is present but not an admin", () => {
    const auth: AuthUser = {
      userId: "user-1",
      groups: [],
      isAdmin: false,
      claims: { sub: "user-1", exp: 1, iat: 1 },
    };
    const request: RequestWithAuth = { auth } as unknown as RequestWithAuth;

    expect(() => guard.canActivate(createContext(request))).toThrow(
      ForbiddenError,
    );
  });

  it("throws when auth is missing", () => {
    const request = {} as unknown as RequestWithAuth;

    expect(() => guard.canActivate(createContext(request))).toThrow(
      ForbiddenError,
    );
  });
});
