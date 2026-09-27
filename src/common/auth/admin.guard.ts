import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Injectable } from "@nestjs/common";

import type { RequestWithAuth } from "@/common/auth/auth.types";
import { ForbiddenError } from "@/common/errors/app.error";

/**
 * Restricts a route to callers whose resolved identity is an admin. Must
 * run after {@link JwtAuthGuard} has populated `request.auth`.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  /**
   * Decides whether the current request's caller is an admin.
   *
   * @param context - The current execution context.
   * @returns `true` when the caller is an admin.
   * @throws {ForbiddenError} When the caller is missing or not an admin.
   */
  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();

    if (request.auth?.isAdmin !== true) {
      throw new ForbiddenError("Admin privileges required");
    }

    return true;
  }
}
