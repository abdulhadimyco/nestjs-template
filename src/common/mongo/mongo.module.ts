import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { AppConfigService } from "@/config/app-config.service";

/**
 * Wraps `MongooseModule.forRootAsync` with this service's typed config.
 * `autoIndex` and `autoCreate` are both disabled: collections here are
 * shared production data, and index creation is a reviewed Atlas step, not
 * a side effect of the app booting. Feature modules call
 * `MongooseModule.forFeature` themselves for their own schemas.
 */
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        uri: config.mongoUri,
        autoIndex: false,
        autoCreate: false,
      }),
    }),
  ],
})
export class MongoModule {}
