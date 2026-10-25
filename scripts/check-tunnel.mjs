const base = new URL(process.argv[2] ?? `http://127.0.0.1:${process.env.SKYLINE_PROXY_PORT ?? 8080}`);

async function checkHttp(path, verify) {
  const headers = /\.ngrok-free\.(app|dev)$/.test(base.hostname) ? { "ngrok-skip-browser-warning": "true" } : {};
  const response = await fetch(new URL(path, base), { headers, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  const body = await response.text();
  if (!verify(body)) throw new Error(`${path}: unexpected response`);
  console.log(`OK ${path} (HTTP ${response.status})`);
  return body;
}

async function checkBrowserScript(html) {
  const assetPath = html.match(/\/_next\/static\/[^"'\s<>]+\.js/)?.[0];
  if (!assetPath) throw new Error("No Next.js browser script found");
  const response = await fetch(new URL(assetPath, base), {
    headers: {
      ...(base.protocol === "https:" ? { "ngrok-skip-browser-warning": "true" } : {}),
      origin: base.origin,
      "sec-fetch-mode": "cors",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok || !(response.headers.get("content-type") ?? "").includes("javascript")) {
    throw new Error(`${assetPath}: browser script HTTP ${response.status}`);
  }
  console.log(`OK Next.js browser script (HTTP ${response.status})`);
}

function checkSocket() {
  const url = new URL("/socket.io/?EIO=4&transport=websocket", base);
  url.protocol = base.protocol === "https:" ? "wss:" : "ws:";
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timeout = setTimeout(() => { socket.close(); reject(new Error("Socket.IO timeout")); }, 15000);
    socket.addEventListener("message", (event) => {
      const packet = String(event.data);
      if (packet.startsWith("0")) {
        clearTimeout(timeout);
        socket.close();
        console.log("OK /socket.io (WebSocket upgrade + Engine.IO open)");
        resolve();
      }
    });
    socket.addEventListener("error", () => { clearTimeout(timeout); reject(new Error("Socket.IO connection failed")); });
  });
}

try {
  const html = await checkHttp("/admin/login", (body) => body.includes("SKYLINE"));
  await checkBrowserScript(html);
  await checkHttp("/interfaces/lobby/waiting", (body) => body.includes("SKYLINE"));
  await checkHttp("/api/health", (body) => JSON.parse(body).service === "skyline-api");
  await checkSocket();
  console.log(`All checks passed: ${base.origin}`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
