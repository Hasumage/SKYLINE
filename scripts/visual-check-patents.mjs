import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const origin = "http://127.0.0.1:8080";
const debug = "http://127.0.0.1:9226";
const browser = spawn(process.env.SKYLINE_BROWSER_EXE ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", ["--headless=new", "--disable-gpu", "--no-first-run", "--remote-debugging-port=9226", `--user-data-dir=${join(tmpdir(), `skyline-patents-${randomUUID()}`)}`, "about:blank"], { stdio: "ignore", windowsHide: true });
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
  async function clickText(selector, label) { const clicked = await evaluate(`(() => { const button = [...document.querySelectorAll(${JSON.stringify(selector)})].find((item) => item.textContent.includes(${JSON.stringify(label)})); button?.click(); return Boolean(button); })()`); if (!clicked) throw new Error(`Button not found: ${label}`); await wait(80); }
  async function fillName(value) { await evaluate(`(() => { const input = document.querySelector('.science-form input'); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event('input', { bubbles: true })); })()`); await wait(80); }
  async function screenshot(path) { const result = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false }); await writeFile(path, Buffer.from(result.data, "base64")); }

  await send("Page.enable"); await send("Runtime.enable"); await mkdir("artifacts", { recursive: true });
  for (const [width, height] of [[1440, 900], [1024, 768], [390, 844]]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 500 });
    await send("Page.navigate", { url: `${origin}/interfaces/patents` }); await wait(1100);
    const initial = JSON.parse(await evaluate("JSON.stringify({ title: document.querySelector('.science-header h1')?.textContent, team: document.querySelector('.science-team-heading h2')?.textContent, count: document.querySelector('.science-form-row strong')?.textContent, width: document.documentElement.scrollWidth, actionsVisible: (() => { const rect = document.querySelector('.science-actions')?.getBoundingClientRect(); const panel = document.querySelector('.science-workspace')?.getBoundingClientRect(); return !!rect && !!panel && rect.bottom <= panel.bottom; })() })"));
    if (initial.title !== "Наука" || initial.team !== "Команда Альфа" || !initial.count.includes("0 из 2") || initial.width > width || !initial.actionsVisible || !await evaluate("document.querySelector('.science-form input')?.value === '' && document.querySelectorAll('.science-registered > div > div').length === 0 && !document.body.textContent.includes('Принять заявку')")) throw new Error(`${width}x${height}: initial ${JSON.stringify(initial)}`);
    await screenshot(`artifacts/patents-initial-${width}x${height}.png`);
    await clickText(".icon-select-trigger", "Энергетика");
    if (!await evaluate("document.querySelectorAll('.icon-select-menu [role=option]').length === 6")) throw new Error(`${width}x${height}: industry options missing`);
    await screenshot(`artifacts/patents-industries-${width}x${height}.png`);
    await clickText(".icon-select-menu button", "Металлургия");
    if (!await evaluate("document.querySelector('.icon-select-trigger')?.textContent.includes('Металлургия') && !!document.querySelector('.icon-select-trigger .icon-select-icon--metal')")) throw new Error(`${width}x${height}: industry icon did not change`);
    await clickText(".science-actions button", "Патенты");
    if (!await evaluate("!!document.querySelector('.science-dialog') && document.querySelectorAll('.science-dialog-list article').length === 0")) throw new Error(`${width}x${height}: initial list not empty`);
    await clickText(".science-dialog-header button", "");
    await fillName("Тестовый патент 1");
    if (!await evaluate("document.querySelector('.science-actions button.is-primary')?.disabled === false")) throw new Error(`${width}x${height}: registration not enabled`);
    await clickText(".science-actions button", "Зарегистрировать патент");
    if (!await evaluate("document.querySelector('.science-form-row strong')?.textContent.includes('1 из 2') && document.querySelector('.science-notice')?.textContent.includes('зарегистрирован') && document.querySelector('.science-form input')?.value === ''")) throw new Error(`${width}x${height}: registration failed`);
    await fillName("Тестовый патент 2");
    await clickText(".science-actions button", "Зарегистрировать патент");
    if (!await evaluate("document.querySelector('.science-form-row strong')?.textContent.includes('2 из 2') && document.querySelector('.science-actions button.is-primary')?.disabled")) throw new Error(`${width}x${height}: two-patent limit failed`);
    await clickText(".science-team-row", "Команда Бета");
    if (!await evaluate("document.querySelector('.science-team-heading h2')?.textContent === 'Команда Бета' && document.querySelector('.science-form-row strong')?.textContent.includes('0 из 2') && document.querySelector('.science-form input')?.value === ''")) throw new Error(`${width}x${height}: team selection failed`);
    await clickText(".science-actions button", "Патенты");
    if (!await evaluate("!!document.querySelector('.science-dialog') && document.querySelectorAll('.science-dialog-list article').length === 2")) throw new Error(`${width}x${height}: patent list missing`);
    await screenshot(`artifacts/patents-list-${width}x${height}.png`);
    await clickText(".science-dialog-header button", "");
    if (errors.length) throw new Error(`${width}x${height}: browser errors ${errors.join('; ')}`);
    console.log(`${width}x${height}: OK`);
  }
  socket.close();
} finally { browser.kill(); }
