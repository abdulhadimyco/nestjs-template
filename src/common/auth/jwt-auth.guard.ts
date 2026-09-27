import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { AUTH_METADATA } from "@/common/auth/auth.constants";
import type { RequestWithAuth } from "@/common/auth/auth.types";
import { extractBearerToken, toAuthUser } from "@/common/auth/claims.util";
import { TokenService } from "@/common/auth/token.service";
import { UnauthorizedError } from "@/common/errors/app.error";

/**
 * Resolves the caller's identity from the `Authorization` header and
 * attaches it to `request.auth`. Honours `@Public()` (skips verification
 * entirely) and `@OptionalAuth()` (allows the request through when no
 * valid token is present).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  /**
   * Creates the guard.
   *
   * @param reflector - Reads the `@Public()`/`@OptionalAuth()` metadata.
   * @param tokenService - Verifies and decodes access tokens.
   */
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * Verifies the token and attaches the resolved identity to the request.
   *
   * @param request - The current request.
   * @param token - The extracted bearer token.
   * @param isOptional - Whether a failed verification should still allow
   * the request through.
   * @returns `true` when the request may proceed.
   * @throws {UnauthorizedError} When verification fails and auth is
   * required.
   */
  private authenticate(
    request: RequestWithAuth,
    token: string,
    isOptional: boolean,
  ): boolean {
    try {
      request.auth = toAuthUser(this.tokenService.verify(token));
      return true;
    } catch (error) {
      if (isOptional) {
        return true;
      }

      throw error;
    }
  }

  /**
   * Reads a boolean metadata flag from the handler, falling back to the
   * controller class.
   *
   * @param context - The current execution context.
   * @param key - The metadata key to read.
   * @returns Whether the flag is set on the handler or its class.
   */
  private readMetadata(context: ExecutionContext, key: string): boolean {
    return (
      this.reflector.getAllAndOverride<boolean | undefined>(key, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false
    );
  }

  /**
   * Decides whether the current request may proceed, resolving its
   * identity as a side effect when a token is present.
   *
   * @param context - The current execution context.
   * @returns `true` when the request may proceed.
   * @throws {UnauthorizedError} When authentication is required and the
   * token is missing or invalid.
   */
  public canActivate(context: ExecutionContext): boolean {
    if (this.readMetadata(context, AUTH_METADATA.IS_PUBLIC)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const token = extractBearerToken(request.headers);
    const isOptional = this.readMetadata(context, AUTH_METADATA.IS_OPTIONAL);

    if (token === undefined) {
      if (isOptional) {
        return true;
      }

      throw new UnauthorizedError("Missing access token");
    }

    return this.authenticate(request, token, isOptional);
  }
}
