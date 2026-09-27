import { Global, Module } from "@nestjs/common";

import { AppConfigService } from "@/config/app-config.service";
import { parseEnv } from "@/config/env.schema";

/**
 * Global module providing the typed {@link AppConfigService}. `process.env`
 * is read exactly once here, via {@link parseEnv}.
 */
@Global()
@Module({
  providers: [
    {
      provide: AppConfigService,
      useFactory: (): AppConfigService => {
        // eslint-disable-next-line no-restricted-properties
        const env = parseEnv(process.env);
        return new AppConfigService(env);
      },
    },
  ],
  exports: [AppConfigService],
})
export class AppConfigModule {}
