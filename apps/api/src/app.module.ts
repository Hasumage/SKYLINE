import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import { HealthController } from "./health.controller.js";
import { LobbyController } from "./lobby.controller.js";
import { LobbyService } from "./lobby.service.js";

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? "info",
        redact: ["req.headers.authorization", "req.headers.cookie"],
      },
    }),
  ],
  controllers: [HealthController, LobbyController],
  providers: [LobbyService],
})
export class AppModule {}

