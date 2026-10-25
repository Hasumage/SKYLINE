import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const origin = "http://127.0.0.1:8080";
const debug = "http://127.0.0.1:9224";
const browser = spawn(process.env.SKYLINE_BROWSER_EXE ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", ["--headless=new", "--disable-gpu", "--no-first-run", "--remote-debugging-port=9224", `--user-data-dir=${join(tmpdir(), `skyline-bank-${randomUUID()}`)}`, "about:blank"], { stdio: "ignore", windowsHide: true });
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

  await send("Page.enable");
  await send("Runtime.enable");
  await mkdir("artifacts", { recursive: true });
  for (const [width, height] of [[1440, 900], [1024, 768], [390, 844]]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 500 });
    await send("Page.navigate", { url: `${origin}/interfaces/atm` }); await wait(1100); await screenshot(`artifacts/atm-reference-${width}x${height}.png`);
    await send("Page.navigate", { url: `${origin}/interfaces/bank` }); await wait(1100);
    const initial = JSON.parse(await evaluate("JSON.stringify({ title: document.querySelector('header h1')?.textContent, mode: document.querySelector('header p')?.textContent, team: document.querySelector('section h2')?.textContent, quote: document.querySelector('section')?.textContent.includes('70 000 ₽'), width: document.documentElement.scrollWidth })"));
    if (initial.title !== "Банк" || initial.mode !== "Оформление кредита" || initial.team !== "Команда Бета" || !initial.quote || initial.width > width) throw new Error(`${width}x${height}: initial ${JSON.stringify(initial)}`);
    await screenshot(`artifacts/bank-default-${width}x${height}.png`);
    await clickText('aside[aria-label="Команды"] button', "Команда Альфа");
    if (!await evaluate("document.querySelector('header p')?.textContent === 'Оформление кредита'")) throw new Error(`${width}x${height}: team selection changed default mode`);
    await clickText('aside[aria-label="Действия банка"] button', "Внести погашение");
    await screenshot(`artifacts/bank-repay-${width}x${height}.png`);
    await input('aside[aria-label="Команды"] input', "Гамма");
    if (!await evaluate("document.querySelectorAll('aside[aria-label=\"Команды\"] button').length === 1")) throw new Error(`${width}x${height}: search failed`);
    await input('aside[aria-label="Команды"] input', "");
    await input('aside[aria-label="Действия банка"] input', "5 000");
    await clickText('aside[aria-label="Действия банка"] button', "Внести сумму");
    if (!await evaluate("document.querySelector('section')?.textContent.includes('20 000')")) throw new Error(`${width}x${height}: partial repayment failed`);
    await input('aside[aria-label="Действия банка"] input', "21 000");
    if (!await evaluate("[...document.querySelectorAll('aside[aria-label=\"Действия банка\"] button')].find((item) => item.textContent.includes('Внести сумму'))?.disabled")) throw new Error(`${width}x${height}: overpayment accepted`);
    await clickText('aside[aria-label="Действия банка"] button', "Погасить полностью");
    await clickText('aside[aria-label="Действия банка"] button', "Внести сумму");
    if (!await evaluate("document.querySelector('section')?.textContent.includes('Кредит погашен')")) throw new Error(`${width}x${height}: payoff failed`);
    await clickText('aside[aria-label="Команды"] button', "Команда Бета");
    if (!await evaluate("document.querySelector('header p')?.textContent === 'Погашение кредита'")) throw new Error(`${width}x${height}: team selection changed mode`);
    await clickText('aside[aria-label="Действия банка"] button', "Оформить кредит");
    if (!await evaluate("document.querySelector('section')?.textContent.includes('70 000 ₽') && document.querySelector('section')?.textContent.includes('17 500 ₽')")) throw new Error(`${width}x${height}: quote failed`);
    await screenshot(`artifacts/bank-issue-${width}x${height}.png`);
    await clickText('aside[aria-label="Действия банка"] button', "Согласовать условия");
    await screenshot(`artifacts/bank-delivery-${width}x${height}.png`);
    await clickText('aside[aria-label="Действия банка"] button', "Выдать наличными");
    if (!await evaluate("document.querySelector('aside[aria-label=\"Команды\"]')?.textContent.includes('70 000 ₽') && document.querySelector('.bank-team-balance')?.textContent.includes('96 000 ₽')")) throw new Error(`${width}x${height}: cash loan failed`);
    await clickText('aside[aria-label="Команды"] button', "Команда Дельта");
    if (!await evaluate("document.querySelector('header p')?.textContent === 'Погашение кредита'")) throw new Error(`${width}x${height}: second team selection changed mode`);
    await clickText('aside[aria-label="Действия банка"] button', "Оформить кредит");
    await clickText('aside[aria-label="Действия банка"] button', "Согласовать условия");
    await clickText('aside[aria-label="Действия банка"] button', "Начислить на баланс");
    if (!await evaluate("document.querySelector('aside[aria-label=\"Действия банка\"] [role=status]')?.textContent.includes('50 000 ₽') && document.querySelector('.bank-team-balance')?.textContent.includes('162 000 ₽')")) throw new Error(`${width}x${height}: balance loan failed`);
    if (errors.length) throw new Error(`${width}x${height}: browser errors ${errors.join('; ')}`);
    console.log(`${width}x${height}: OK`);
  }
  socket.close();
} finally { browser.kill(); }
