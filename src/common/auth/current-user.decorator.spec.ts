import type { ExecutionContext } from "@nestjs/common";
import { ROUTE_ARGS_METADATA } from "@nestjs/common/constants";

import type { AuthUser, RequestWithAuth } from "@/common/auth/auth.types";
import {
  CurrentUser,
  resolveCurrentUser,
} from "@/common/auth/current-user.decorator";

/** The shape Nest stores per parameter under `ROUTE_ARGS_METADATA`. */
type RouteArgMetadataEntry = {
  factory: (data: unknown, context: ExecutionContext) => unknown;
};

const sampleAuth: AuthUser = {
  userId: "user-1",
  groups: [],
  isAdmin: false,
  claims: { sub: "user-1", exp: 1, iat: 1 },
};

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

describe("resolveCurrentUser", () => {
  it("returns the request's auth when present", () => {
    const request: RequestWithAuth = {
      auth: sampleAuth,
    } as unknown as RequestWithAuth;
    const context = createContext(request);

    expect(resolveCurrentUser(context)).toBe(sampleAuth);
  });

  it("returns undefined when the request has no auth", () => {
    const request = {} as unknown as RequestWithAuth;
    const context = createContext(request);

    expect(resolveCurrentUser(context)).toBeUndefined();
  });
});

/**
 * Reads the parameter-decorator factory Nest stored for a controller
 * method's single decorated parameter.
 *
 * @param target - The controller class.
 * @param methodName - The decorated method's name.
 * @returns The stored factory function.
 */
function getSingleParamFactory(
  target: object,
  methodName: string,
): RouteArgMetadataEntry["factory"] {
  // eslint-disable-next-line unicorn/no-nonstandard-builtin-properties -- getMetadata is added by the reflect-metadata polyfill Nest itself depends on.
  const args: unknown = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    target,
    methodName,
  );
  const entries = Object.values(args as Record<string, RouteArgMetadataEntry>);
  const [entry] = entries;

  if (entry === undefined) {
    throw new Error("Expected exactly one route arg metadata entry");
  }

  return entry.factory;
}

describe("CurrentUser", () => {
  it("resolves the request's auth via its stored factory", () => {
    class TestController {
      // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars -- unused parameter exists only to carry the decorator under test; underscore marks it unused for noUnusedParameters.
      public handler(@CurrentUser() _user: AuthUser | undefined): void {
        return;
      }
    }

    const factory = getSingleParamFactory(TestController, "handler");
    const request: RequestWithAuth = {
      auth: sampleAuth,
    } as unknown as RequestWithAuth;
    const context = createContext(request);

    expect(factory(undefined, context)).toBe(sampleAuth);
  });
});
