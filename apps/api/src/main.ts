import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Server } from "socket.io";
import { AppModule } from "./app.module.js";
import { LobbyService } from "./lobby.service.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const localOrigins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
  ];
  app.setGlobalPrefix("api");
  app.enableCors({
    origin: localOrigins,
    credentials: true,
  });

  const io = new Server(app.getHttpServer(), {
    path: "/socket.io",
    cors: { origin: localOrigins, credentials: true },
  });
  const lobby = app.get(LobbyService);
  lobby.attachSocketServer(io);
  io.on("connection", (socket) => {
    void lobby.connect(socket).catch(() => socket.disconnect(true));
  });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, "127.0.0.1");
}

void bootstrap();

