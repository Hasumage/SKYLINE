import { createServer, request as httpRequest } from "node:http";

const host = "127.0.0.1";
const port = Number(process.env.SKYLINE_PROXY_PORT ?? 8080);
const webPort = Number(process.env.SKYLINE_WEB_PORT ?? 3000);
const apiPort = Number(process.env.SKYLINE_API_PORT ?? 3001);

function upstreamPort(url) {
  const path = new URL(url ?? "/", "http://localhost").pathname;
  return path === "/api" || path.startsWith("/api/") || path === "/socket.io" || path.startsWith("/socket.io/") ? apiPort : webPort;
}

function upstreamOptions(request) {
  const targetPort = upstreamPort(request.url);
  return {
    host,
    port: targetPort,
    method: request.method,
    path: request.url,
    headers: {
      ...request.headers,
      host: `${host}:${targetPort}`,
      "x-forwarded-host": request.headers.host,
    },
  };
}

const server = createServer((request, response) => {
  const upstream = httpRequest(upstreamOptions(request), (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
    upstreamResponse.pipe(response);
  });
  upstream.on("error", () => {
    if (!response.headersSent) response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    response.end("SKYLINE upstream is unavailable");
  });
  request.on("error", () => upstream.destroy());
  response.on("error", () => upstream.destroy());
  request.pipe(upstream);
});

server.on("upgrade", (request, socket, head) => {
  const upstream = httpRequest(upstreamOptions(request));
  upstream.on("upgrade", (response, upstreamSocket, upstreamHead) => {
    const headerLines = [];
    for (let index = 0; index < response.rawHeaders.length; index += 2) {
      headerLines.push(`${response.rawHeaders[index]}: ${response.rawHeaders[index + 1]}`);
    }
    socket.write(`HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\n${headerLines.join("\r\n")}\r\n\r\n`);
    if (upstreamHead.length) socket.write(upstreamHead);
    if (head.length) upstreamSocket.write(head);
    upstreamSocket.on("error", () => socket.destroy());
    socket.pipe(upstreamSocket).pipe(socket);
  });
  upstream.on("response", (response) => {
    socket.end(`HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\nConnection: close\r\n\r\n`);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
  upstream.end();
});

server.on("error", (error) => {
  console.error(`SKYLINE proxy failed on ${host}:${port}:`, error);
  process.exitCode = 1;
});
server.listen(port, host, () => console.log(`SKYLINE proxy: http://${host}:${port} (web:${webPort}, api:${apiPort})`));
