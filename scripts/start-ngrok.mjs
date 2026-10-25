import { spawn } from "node:child_process";

const proxyPort = Number(process.env.SKYLINE_PROXY_PORT ?? 8080);
const localUrl = `http://127.0.0.1:${proxyPort}`;
const inspectorUrl = "http://127.0.0.1:4040/api/tunnels";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function runCheck(command, args) {
  return new Promise((resolve, reject) => {
    const check = spawn(command, args, { stdio: "inherit" });
    check.on("error", reject);
    check.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} failed`)));
  });
}

async function waitForLocalStack() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const [page, api] = await Promise.all([
        fetch(`${localUrl}/interfaces/lobby/waiting`, { signal: AbortSignal.timeout(2000) }),
        fetch(`${localUrl}/api/health`, { signal: AbortSignal.timeout(2000) }),
      ]);
      if (page.ok && api.ok) return;
    } catch {
      // The dev servers may still be starting.
    }
    await delay(1000);
  }
  throw new Error(`SKYLINE did not become ready at ${localUrl}. Run npm run dev and check its logs.`);
}

await waitForLocalStack();
await runCheck(process.execPath, ["scripts/check-tunnel.mjs"]);
if (process.platform === "win32") {
  await runCheck("cmd.exe", ["/d", "/s", "/c", "npm run db:status"]);
} else {
  await runCheck("npm", ["run", "db:status"]);
}

try {
  const inspector = await fetch(inspectorUrl, { signal: AbortSignal.timeout(1000) });
  if (inspector.ok) throw new Error("An ngrok agent is already running on port 4040. Stop it before starting a new tunnel.");
} catch (error) {
  if (error.message?.includes("already running")) throw error;
}

const ngrok = spawn("ngrok", ["http", String(proxyPort), "--log", "stdout"], { stdio: "inherit" });
let stopped = false;
ngrok.on("error", (error) => {
  stopped = true;
  console.error(`Cannot start ngrok: ${error.message}. Install ngrok and add your authtoken.`);
  process.exitCode = 1;
});
ngrok.on("exit", (code) => {
  stopped = true;
  process.exitCode = code ?? 1;
});

process.on("SIGINT", () => ngrok.kill("SIGINT"));
process.on("SIGTERM", () => ngrok.kill("SIGTERM"));

let publicUrl;
for (let attempt = 0; attempt < 30 && !stopped; attempt += 1) {
  try {
    const response = await fetch(inspectorUrl, { signal: AbortSignal.timeout(1000) });
    if (response.ok) {
      const data = await response.json();
      const tunnel = data.tunnels?.find((item) => item.public_url?.startsWith("https://"));
      if (tunnel) {
        publicUrl = tunnel.public_url;
        break;
      }
    }
  } catch {
    // ngrok's local API starts after its agent process.
  }
  await delay(1000);
}

if (!publicUrl && !stopped) {
  console.error("ngrok started but did not publish an HTTPS URL. Check the agent logs above.");
  ngrok.kill();
  process.exitCode = 1;
}

if (publicUrl) {
  let verified = false;
  for (let attempt = 0; attempt < 5 && !verified; attempt += 1) {
    try {
      await runCheck(process.execPath, ["scripts/check-tunnel.mjs", publicUrl]);
      verified = true;
    } catch {
      if (attempt < 4) await delay(2000);
    }
  }
  if (verified) {
    console.log(`SKYLINE public URL: ${publicUrl}`);
  } else {
    console.error(`The ngrok URL is not ready: ${publicUrl}`);
    ngrok.kill();
    process.exitCode = 1;
  }
}
