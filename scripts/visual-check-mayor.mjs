import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const origin = "http://127.0.0.1:8080";
const debug = "http://127.0.0.1:9228";
const browser = spawn(process.env.SKYLINE_BROWSER_EXE ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", ["--headless=new", "--disable-gpu", "--no-first-run", "--remote-debugging-port=9228", `--user-data-dir=${join(tmpdir(), `skyline-mayor-${randomUUID()}`)}`, "about:blank"], { stdio: "ignore", windowsHide: true });
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
  async function clickText(selector, label) { const clicked = await evaluate(`(() => { const button = [...document.querySelectorAll(${JSON.stringify(selector)})].find((item) => item.textContent.includes(${JSON.stringify(label)})); button?.click(); return Boolean(button); })()`); if (!clicked) throw new Error(`Button not found: ${label}`); await wait(100); }
  async function screenshot(path) { const result = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false }); await writeFile(path, Buffer.from(result.data, "base64")); }

  await send("Page.enable"); await send("Runtime.enable"); await mkdir("artifacts", { recursive: true });
  for (const [width, height] of [[320, 700], [390, 844], [430, 932]]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: true });
    await send("Page.navigate", { url: `${origin}/interfaces/mayor` }); await wait(1100);
    const initial = JSON.parse(await evaluate("JSON.stringify({ title: document.querySelector('.mayor-header h1')?.textContent, width: document.documentElement.scrollWidth, nav: document.querySelectorAll('.mayor-nav button').length, navBottom: document.querySelector('.mayor-nav')?.getBoundingClientRect().bottom, images: [...document.querySelectorAll('.mayor-emergency-list img')].map((image) => image.naturalWidth), duplicateNeeds: !!document.querySelector('.mayor-overview-emergency .mayor-need') })"));
    if (initial.title !== "Мэр города" || initial.width > width || initial.nav !== 4 || Math.abs(initial.navBottom - height) > 1 || initial.images.length !== 2 || initial.images.some((value) => !value) || initial.duplicateNeeds) throw new Error(`${width}x${height}: overview ${JSON.stringify(initial)}`);
    await screenshot(`artifacts/mayor-overview-${width}x${height}.png`);
    await clickText(".mayor-nav button", "Цели");
    if (!await evaluate("document.querySelectorAll('.mayor-goal').length === 3")) throw new Error(`${width}x${height}: goals missing`);
    await screenshot(`artifacts/mayor-goals-${width}x${height}.png`);
    await clickText(".mayor-nav button", "ЧП");
    if (!await evaluate(`!!document.querySelector('.mayor-incident') && document.querySelectorAll('.mayor-incident-picker button').length === 5 && document.querySelectorAll('.mayor-incident-needs .mayor-need').length === 3 && document.querySelector('.mayor-incident').getBoundingClientRect().right <= ${width} && [...document.querySelectorAll('.mayor-incident-picker button')].every((button) => button.getBoundingClientRect().right <= document.querySelector('.mayor-incident-picker').getBoundingClientRect().right - 10) && document.documentElement.scrollWidth <= ${width} && Math.abs(document.querySelector('.mayor-nav').getBoundingClientRect().bottom - ${height}) <= 1`)) throw new Error(`${width}x${height}: emergency missing or overflowing`);
    await screenshot(`artifacts/mayor-emergency-${width}x${height}.png`);
    await clickText(".mayor-incident-picker button", "Сбой на электростанции");
    if (!await evaluate("document.querySelector('.mayor-incident h2')?.textContent === 'Сбой на электростанции' && document.querySelector('.mayor-incident-head strong')?.textContent.includes('26 ед. энергии')")) throw new Error(`${width}x${height}: second incident failed`);
    await screenshot(`artifacts/mayor-emergency-power-${width}x${height}.png`);
    await clickText(".mayor-incident-picker button", "Пожар на металлургическом заводе");
    if (!await evaluate("document.querySelector('.mayor-alert')?.textContent.includes('Авария устранена') && document.querySelectorAll('.mayor-incident-needs .mayor-need').length === 2")) throw new Error(`${width}x${height}: resolved incident failed`);
    await screenshot(`artifacts/mayor-emergency-resolved-${width}x${height}.png`);
    await clickText(".mayor-nav button", "Указы");
    if (!await evaluate("document.querySelectorAll('.mayor-decree').length === 3")) throw new Error(`${width}x${height}: decrees missing`);
    await screenshot(`artifacts/mayor-decrees-${width}x${height}.png`);
    await clickText(".mayor-decree", "Промышленное стимулирование");
    if (!await evaluate("!!document.querySelector('.mayor-modal') && !!document.querySelector('.icon-select')")) throw new Error(`${width}x${height}: decree editor missing`);
    await clickText(".icon-select-trigger", "Энергетика");
    await clickText(".icon-select-menu button", "Металлургия");
    await screenshot(`artifacts/mayor-decree-editor-${width}x${height}.png`);
    await clickText(".mayor-issue-button", "Применить указ");
    if (!await evaluate("!document.querySelector('.mayor-modal') && document.querySelector('.mayor-active-decree')?.textContent.includes('Металлургия') && document.querySelector('.mayor-metrics')?.textContent.includes('2/5')")) throw new Error(`${width}x${height}: issuing decree failed`);
    await clickText(".mayor-decree", "Программа взаимопомощи");
    if (!await evaluate("document.querySelector('.mayor-issue-button')?.disabled")) throw new Error(`${width}x${height}: quarter limit failed`);
    await clickText(".mayor-modal-top button", "");
    await clickText(".mayor-decree", "Муниципальный приоритет");
    if (!await evaluate("document.querySelector('.icon-select-trigger')?.textContent.includes('Энергия')")) throw new Error(`${width}x${height}: resource selector missing`);
    await clickText(".icon-select-trigger", "Энергия");
    if (!await evaluate(`document.querySelectorAll('.icon-select-menu [role=option]').length === 5 && document.querySelector('.icon-select-menu').getBoundingClientRect().top >= 0 && document.querySelector('.icon-select-menu').getBoundingClientRect().bottom <= ${height}`)) throw new Error(`${width}x${height}: resource menu mismatch or clipped`);
    await screenshot(`artifacts/mayor-resource-menu-${width}x${height}.png`);
    if (errors.length) throw new Error(`${width}x${height}: browser errors ${errors.join('; ')}`);
    console.log(`${width}x${height}: OK`);
  }
  socket.close();
} finally { browser.kill(); }
