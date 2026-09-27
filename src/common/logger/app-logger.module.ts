import { Global, Module } from "@nestjs/common";

import { AppLogger } from "@/common/logger/app-logger.service";

/** Global module providing the {@link AppLogger} everywhere in the app. */
@Global()
@Module({
  providers: [AppLogger],
  exports: [AppLogger],
})
export class AppLoggerModule {}
