import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const origin = "http://127.0.0.1:8080";
const debug = "http://127.0.0.1:9225";
const browser = spawn(process.env.SKYLINE_BROWSER_EXE ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", ["--headless=new", "--disable-gpu", "--no-first-run", "--remote-debugging-port=9225", `--user-data-dir=${join(tmpdir(), `skyline-construction-${randomUUID()}`)}`, "about:blank"], { stdio: "ignore", windowsHide: true });
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
  async function input(selector, value) { await evaluate(`(() => { const element = document.querySelector(${JSON.stringify(selector)}); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(element, ${JSON.stringify(value)}); element.dispatchEvent(new Event('input', { bubbles: true })); })()`); await wait(60); }
  async function clickText(selector, label) { const clicked = await evaluate(`(() => { const button = [...document.querySelectorAll(${JSON.stringify(selector)})].find((item) => item.textContent.includes(${JSON.stringify(label)})); button?.click(); return Boolean(button); })()`); if (!clicked) throw new Error(`Button not found: ${label}`); await wait(60); }
  async function screenshot(path) { const image = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false }); await writeFile(path, Buffer.from(image.data, "base64")); }

  await send("Page.enable"); await send("Runtime.enable"); await mkdir("artifacts", { recursive: true });
  for (const [width, height] of [[1440, 900], [1024, 768], [390, 844]]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 500 });
    await send("Page.navigate", { url: `${origin}/interfaces/construction` }); await wait(1100);
    const initial = JSON.parse(await evaluate("JSON.stringify({ title: document.querySelector('header h1')?.textContent, team: document.querySelector('aside[aria-label=\"Команды\"] button[aria-current=true] strong')?.textContent, cards: document.querySelectorAll('.construction-catalog-item').length, images: [...document.querySelectorAll('.construction-building-art')].every((item) => getComputedStyle(item).backgroundImage !== 'none'), width: document.documentElement.scrollWidth })"));
    if (initial.title !== "Строительство" || initial.team !== "Команда Альфа" || initial.cards !== 6 || !initial.images || initial.width > width) throw new Error(`${width}x${height}: catalog ${JSON.stringify(initial)}`);
    await clickText('.construction-catalog-filters button', "Газ");
    if (!await evaluate("document.querySelectorAll('.construction-catalog-item').length === 1 && document.querySelector('.construction-catalog-item')?.textContent.includes('Газовый объект')")) throw new Error(`${width}x${height}: catalog resource filter failed`);
    await clickText('.construction-catalog-filters button', "Все");
    if (!await evaluate("document.querySelectorAll('.construction-catalog-item').length === 6")) throw new Error(`${width}x${height}: catalog all filter failed`);
    await screenshot(`artifacts/construction-catalog-${width}x${height}.png`);
    await clickText('.construction-catalog-item', "Жильё");
    if (!await evaluate("document.querySelector('header p')?.textContent === 'Создание объекта' && !!document.querySelector('.construction-form')")) throw new Error(`${width}x${height}: form missing`);
    await screenshot(`artifacts/construction-form-${width}x${height}.png`);
    if (!await evaluate("document.querySelector('.construction-selected-type')?.textContent.includes('Жильё') && !document.querySelector('.construction-form select')")) throw new Error(`${width}x${height}: selected object missing`);
    await clickText('.construction-selected-type', "Изменить");
    if (!await evaluate("document.querySelectorAll('.construction-picker-grid button').length === 6")) throw new Error(`${width}x${height}: object picker missing`);
    await clickText('.construction-picker-filters button', "Газ");
    if (!await evaluate("document.querySelectorAll('.construction-picker-grid button').length === 1 && document.querySelector('.construction-picker-grid button')?.textContent.includes('Газовый объект')")) throw new Error(`${width}x${height}: resource filter failed`);
    await clickText('.construction-picker-filters button', "Все");
    if (!await evaluate("document.querySelectorAll('.construction-picker-grid button').length === 6")) throw new Error(`${width}x${height}: all resources filter failed`);
    await screenshot(`artifacts/construction-picker-${width}x${height}.png`);
    await clickText('.construction-picker-grid button', "Электростанция");
    if (!await evaluate("!document.querySelector('.construction-picker-dialog') && document.querySelector('.construction-selected-type')?.textContent.includes('Электростанция')")) throw new Error(`${width}x${height}: object selection failed`);
    await clickText('.construction-selected-type', "Изменить");
    await clickText('.construction-picker-grid button', "Жильё");
    await input('.construction-form input[type=number]', "2");
    await input('.construction-form input:not([type])', "250");
    if (!await evaluate("document.querySelector('.construction-total strong')?.textContent.includes('500') && !document.querySelector('button:disabled')?.textContent.includes('Подтвердить строительство')")) throw new Error(`${width}x${height}: valid total rejected because unit price is below 500`);
    await input('.construction-form input[type=number]', "3");
    if (!await evaluate("document.querySelector('.construction-total strong')?.textContent.includes('750') && document.querySelector('button:disabled')?.textContent.includes('Подтвердить строительство') && document.querySelector('[role=alert]')?.textContent.includes('Итоговая сумма')")) throw new Error(`${width}x${height}: non-multiple total accepted`);
    await input('.construction-form input:not([type])', "9 000");
    if (!await evaluate("document.querySelector('.construction-total strong')?.textContent.includes('27 000') && !document.querySelector('button:disabled')?.textContent.includes('Подтвердить строительство')")) throw new Error(`${width}x${height}: cash calculation failed`);
    await clickText('section[aria-label="Строительство команды"] button', "Подтвердить строительство");
    if (!await evaluate("document.querySelector('section[aria-label=\"Строительство команды\"] [role=status]')?.textContent.includes('27 000 ₽') && document.querySelector('aside[aria-label=\"Команды\"] button[aria-current=true] small')?.textContent.includes('25 000 ₽')")) throw new Error(`${width}x${height}: cash purchase changed balance`);
    await clickText('aside[aria-label="Команды"] button', "Команда Бета");
    if (!await evaluate("document.querySelector('header p')?.textContent === 'Создание объекта'")) throw new Error(`${width}x${height}: team selection changed view`);
    await clickText('section[aria-label="Строительство команды"] button', "Каталог объектов");
    if (!await evaluate("[...document.querySelectorAll('.construction-catalog-item')].find((item) => item.textContent.includes('Жильё'))?.textContent.includes('5 750 ₽')")) throw new Error(`${width}x${height}: global market price did not update`);
    if (errors.length) throw new Error(`${width}x${height}: browser errors ${errors.join('; ')}`);
    console.log(`${width}x${height}: OK`);
  }
  socket.close();
} finally { browser.kill(); }
