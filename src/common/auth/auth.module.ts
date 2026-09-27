import { Global, Module } from "@nestjs/common";

import { AdminGuard } from "@/common/auth/admin.guard";
import { JwtAuthGuard } from "@/common/auth/jwt-auth.guard";
import { TokenService } from "@/common/auth/token.service";

/**
 * Global module providing the shared authentication/authorization
 * building blocks: token verification and the JWT/admin guards.
 */
@Global()
@Module({
  providers: [TokenService, JwtAuthGuard, AdminGuard],
  exports: [TokenService, JwtAuthGuard, AdminGuard],
})
export class AuthModule {}
