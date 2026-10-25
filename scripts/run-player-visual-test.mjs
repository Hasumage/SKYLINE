import { spawn, spawnSync } from "node:child_process";

if (!process.env.TEST_DATABASE_URL || process.env.TEST_DATABASE_URL === process.env.DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL must point to a separate database");
}

const apiEnv = { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL, PORT: "3101", LOG_LEVEL: "error" };
const proxyEnv = { ...process.env, SKYLINE_PROXY_PORT: "8081", SKYLINE_API_PORT: "3101", SKYLINE_WEB_PORT: "3000" };
const children = [];

async function waitFor(url) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Service did not start: ${url}`);
}

try {
  const api = spawn(process.execPath, ["--import", "tsx", "src/main.ts"], { cwd: "apps/api", env: apiEnv, stdio: "ignore", windowsHide: true });
  children.push(api);
  await waitFor("http://127.0.0.1:3101/api/health");
  const proxy = spawn(process.execPath, ["scripts/dev-proxy.mjs"], { env: proxyEnv, stdio: "ignore", windowsHide: true });
  children.push(proxy);
  await waitFor("http://127.0.0.1:8081/api/health");
  const result = spawnSync(process.execPath, [process.argv[2] ?? "scripts/visual-check-player.mjs"], { stdio: "inherit" });
  if (result.status !== 0) process.exitCode = result.status ?? 1;
} finally {
  for (const child of children.reverse()) child.kill();
}
