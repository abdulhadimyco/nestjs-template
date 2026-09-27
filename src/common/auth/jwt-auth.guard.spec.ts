import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";

import { AUTH_METADATA } from "@/common/auth/auth.constants";
import type { RequestWithAuth } from "@/common/auth/auth.types";
import { JwtAuthGuard } from "@/common/auth/jwt-auth.guard";
import type { TokenService } from "@/common/auth/token.service";
import { UnauthorizedError } from "@/common/errors/app.error";

// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- stand-in for ExecutionContext.getClass()'s return value; only its identity matters.
class FakeController {}

/**
 * The no-op handler function used as `ExecutionContext.getHandler()`'s
 * return value.
 */
function fakeHandler(): void {
  // no-op
}

/**
 * Builds a fake {@link ExecutionContext}/{@link Reflector} pair wrapping a
 * given request and pre-set metadata.
 *
 * @param request - The fake request to expose via `switchToHttp`.
 * @param metadata - The metadata values keyed by metadata key.
 * @returns A minimal {@link ExecutionContext} and {@link Reflector} pair.
 */
function createContext(
  request: RequestWithAuth,
  metadata: Record<string, boolean> = {},
): { context: ExecutionContext; reflector: Reflector } {
  const reflector: Reflector = {
    getAllAndOverride: (key: string): boolean | undefined => metadata[key],
  } as unknown as Reflector;

  const context: ExecutionContext = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => fakeHandler,
    getClass: () => FakeController,
  } as unknown as ExecutionContext;

  return { context, reflector };
}

describe("JwtAuthGuard", () => {
  const validClaims = { sub: "user-1", exp: 1, iat: 1 };

  it("allows a public route without inspecting the token", () => {
    const tokenService = { verify: jest.fn() } as unknown as TokenService;
    const request = { headers: {} } as unknown as RequestWithAuth;
    const { context, reflector } = createContext(request, {
      [AUTH_METADATA.IS_PUBLIC]: true,
    });
    const guard = new JwtAuthGuard(reflector, tokenService);

    expect(guard.canActivate(context)).toBe(true);
    expect(tokenService.verify).not.toHaveBeenCalled();
  });

  it("throws when the token is missing and auth is required", () => {
    const tokenService = { verify: jest.fn() } as unknown as TokenService;
    const request = { headers: {} } as unknown as RequestWithAuth;
    const { context, reflector } = createContext(request);
    const guard = new JwtAuthGuard(reflector, tokenService);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedError);
  });

  it("allows an optional route through when the token is missing", () => {
    const tokenService = { verify: jest.fn() } as unknown as TokenService;
    const request = { headers: {} } as unknown as RequestWithAuth;
    const { context, reflector } = createContext(request, {
      [AUTH_METADATA.IS_OPTIONAL]: true,
    });
    const guard = new JwtAuthGuard(reflector, tokenService);

    expect(guard.canActivate(context)).toBe(true);
    expect(tokenService.verify).not.toHaveBeenCalled();
  });

  it("attaches auth and allows through on a valid token", () => {
    const tokenService = {
      verify: jest.fn().mockReturnValue(validClaims),
    } as unknown as TokenService;
    const request = {
      headers: { authorization: "Bearer good" },
    } as unknown as RequestWithAuth;
    const { context, reflector } = createContext(request);
    const guard = new JwtAuthGuard(reflector, tokenService);

    expect(guard.canActivate(context)).toBe(true);
    expect(request.auth?.userId).toBe("user-1");
  });

  it("throws on an invalid token when auth is required", () => {
    const tokenService = {
      verify: jest.fn().mockImplementation(() => {
        throw new UnauthorizedError("bad token");
      }),
    } as unknown as TokenService;
    const request = {
      headers: { authorization: "Bearer bad" },
    } as unknown as RequestWithAuth;
    const { context, reflector } = createContext(request);
    const guard = new JwtAuthGuard(reflector, tokenService);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedError);
  });

  it("allows through with no auth attached on an invalid token when optional", () => {
    const tokenService = {
      verify: jest.fn().mockImplementation(() => {
        throw new UnauthorizedError("bad token");
      }),
    } as unknown as TokenService;
    const request = {
      headers: { authorization: "Bearer bad" },
    } as unknown as RequestWithAuth;
    const { context, reflector } = createContext(request, {
      [AUTH_METADATA.IS_OPTIONAL]: true,
    });
    const guard = new JwtAuthGuard(reflector, tokenService);

    expect(guard.canActivate(context)).toBe(true);
    expect(request.auth).toBeUndefined();
  });
});
