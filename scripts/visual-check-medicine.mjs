import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const origin = "http://127.0.0.1:8080";
const debug = "http://127.0.0.1:9227";
const browser = spawn(process.env.SKYLINE_BROWSER_EXE ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", ["--headless=new", "--disable-gpu", "--no-first-run", "--remote-debugging-port=9227", `--user-data-dir=${join(tmpdir(), `skyline-medicine-${randomUUID()}`)}`, "about:blank"], { stdio: "ignore", windowsHide: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

try {
  for (let attempt = 0; attempt < 40; attempt++) { try { if ((await fetch(`${debug}/json/version`)).ok) break; } catch {} await wait(200); }
  const pages = await (await fetch(`${debug}/json/list`)).json();
  const page = pages.find((item) => item.type === "page");
  if (!page) throw new Error("Browser page not found");
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));
  let id = 0;
  const pending = new Map();
  const errors = [];
  socket.addEventListener("message", ({ data }) => { const message = JSON.parse(data); if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text); const promise = pending.get(message.id); if (!promise) return; pending.delete(message.id); message.error ? promise.reject(new Error(message.error.message)) : promise.resolve(message.result); });
  function send(method, params = {}) { const requestId = ++id; return new Promise((resolve, reject) => { pending.set(requestId, { resolve, reject }); socket.send(JSON.stringify({ id: requestId, method, params })); }); }
  async function evaluate(expression) { const result = await send("Runtime.evaluate", { expression, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; }
  async function screenshot(path) { const result = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false }); await writeFile(path, Buffer.from(result.data, "base64")); }

  await send("Page.enable"); await send("Runtime.enable"); await mkdir("artifacts", { recursive: true });
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 500 });
    await send("Page.navigate", { url: `${origin}/interfaces/medicine` }); await wait(1100);
    if (!await evaluate("document.querySelector('.medicine-header h1')?.textContent === 'Медицина' && document.querySelectorAll('.medicine-toolbar button:disabled').length === 3 && document.querySelector('.medicine-toolbar').getBoundingClientRect().right <= document.querySelector('.medicine-workspace').getBoundingClientRect().right")) throw new Error(`${width}x${height}: initial state invalid`);
    await screenshot(`artifacts/medicine-initial-${width}x${height}.png`);
    await evaluate("document.querySelector('.medicine-toolbar button')?.click()"); await wait(100);
    if (!await evaluate("document.querySelectorAll('.medicine-event-row').length === 1 && document.querySelectorAll('.medicine-toolbar button:disabled').length === 2")) throw new Error(`${width}x${height}: draft invalid`);
    await evaluate("(() => { const input = document.querySelector('.medicine-field input'); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, 'Проверочное событие'); input.dispatchEvent(new Event('input', { bubbles: true })); })()");
    await evaluate("document.querySelector('.medicine-team-grid input')?.click()"); await wait(100);
    if (!await evaluate("document.querySelectorAll('.medicine-toolbar button:disabled').length === 1")) throw new Error(`${width}x${height}: launch not enabled`);
    await screenshot(`artifacts/medicine-draft-${width}x${height}.png`);
    await evaluate("document.querySelectorAll('.medicine-toolbar button')[2].click()"); await wait(100);
    if (!await evaluate("document.querySelector('.medicine-event-row small')?.textContent.includes('1 команд') && document.querySelector('.medicine-detail-status')?.textContent === 'Активно'")) throw new Error(`${width}x${height}: launch failed`);
    await screenshot(`artifacts/medicine-active-${width}x${height}.png`);
    await evaluate("document.querySelectorAll('.medicine-toolbar button')[3].click()"); await wait(100);
    if (!await evaluate("document.querySelectorAll('.medicine-event-row').length === 0 && document.querySelectorAll('.medicine-history-row').length === 1 && document.querySelector('.medicine-detail-status')?.textContent === 'Завершено'")) throw new Error(`${width}x${height}: finish failed`);
    await screenshot(`artifacts/medicine-finished-${width}x${height}.png`);
    if (errors.length) throw new Error(`${width}x${height}: browser errors ${errors.join('; ')}`);
    console.log(`${width}x${height}: OK`);
  }
  socket.close();
} finally { browser.kill(); }
