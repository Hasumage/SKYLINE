import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || testUrl === process.env.DATABASE_URL) throw new Error("TEST_DATABASE_URL must point to a separate database");

await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once("error", () => reject(new Error("Port 3101 is already in use")));
  probe.listen(3101, "127.0.0.1", () => probe.close(resolve));
});

const env = { ...process.env, DATABASE_URL: testUrl, SHADOW_DATABASE_URL: testUrl, PORT: "3101", LOG_LEVEL: "error" };
const migration = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env, stdio: "inherit" });
if (migration.status !== 0) process.exit(migration.status ?? 1);

const api = spawn(process.execPath, ["--import", "tsx", "src/main.ts"], { cwd: "apps/api", env, stdio: "inherit" });
let exited = false;
api.once("exit", () => { exited = true; });
try {
  const deadline = Date.now() + 30000;
  let ready = false;
  while (Date.now() < deadline && !exited) {
    try {
      const response = await fetch("http://127.0.0.1:3101/api/health", { signal: AbortSignal.timeout(1000) });
      if (response.ok) { ready = true; break; }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  if (!ready) throw new Error("Test API did not become ready");
  const test = spawnSync(process.execPath, ["scripts/test-lobby.mjs"], { stdio: "inherit" });
  if (test.status !== 0) process.exitCode = test.status ?? 1;
} finally {
  if (!exited) {
    api.kill("SIGTERM");
    await new Promise((resolve) => { api.once("exit", resolve); setTimeout(resolve, 3000); });
  }
}
