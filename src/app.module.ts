import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";
import { ZodValidationPipe } from "nestjs-zod";

import { AppConfigModule } from "@/config/app-config.module";
import { AuthModule } from "@/common/auth/auth.module";
import { JwtAuthGuard } from "@/common/auth/jwt-auth.guard";
import { CacheModule } from "@/common/cache/cache.module";
import { HttpExceptionFilter } from "@/common/filters/http-exception.filter";
import { RequestLogInterceptor } from "@/common/interceptors/request-log.interceptor";
import { AppLoggerModule } from "@/common/logger/app-logger.module";
import { MongoModule } from "@/common/mongo/mongo.module";

import { HealthModule } from "@/modules/health/health.module";
import { NotesModule } from "@/modules/notes/notes.module";

/**
 * The application's root module.
 *
 * Global cross-cutting modules (config, logger, auth, cache, mongo) come first;
 * feature modules follow. The four APP_* providers install the request
 * pipeline once for every route: JWT guard → Zod validation → handler →
 * request log → exception mapping.
 */
@Module({
  imports: [
    AppConfigModule,
    AppLoggerModule,
    AuthModule,
    CacheModule,
    MongoModule,
    HealthModule,
    NotesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: RequestLogInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
