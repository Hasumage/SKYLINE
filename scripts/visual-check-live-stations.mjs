import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { io } from "socket.io-client";
import pg from "pg";

const origin = "http://127.0.0.1:8081";
const debug = "http://127.0.0.1:9228";
const sockets = [];
let organizerToken;
let browser;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function api(path, token, body, method = body ? "POST" : "GET") {
  const response = await fetch(`${origin}/api${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`${path}: ${response.status} ${JSON.stringify(result)}`);
  return result;
}

async function connect(token) {
  const socket = io(origin, { auth: { token }, transports: ["websocket"], reconnection: false });
  sockets.push(socket);
  await new Promise((resolve, reject) => { socket.once("connect", resolve); socket.once("connect_error", reject); });
}

try {
  const organizer = await api("/admin/login", null, { code: "create" });
  organizerToken = organizer.token;
  const enabled = new Set(["BANK", "CONSTRUCTION", "PATENT_OFFICE", "MEDICINE", "ENTERPRISES"]);
  for (const station of organizer.snapshot.stations) {
    if (!enabled.has(station.type)) await api(`/admin/stations/${station.type}`, organizerToken, { enabled: false }, "PATCH");
  }
  const staff = {};
  for (const type of enabled) {
    staff[type] = (await api("/admin/login", null, { code: organizer.snapshot.codes.staff[type] })).token;
    await connect(staff[type]);
  }
  let alphaId;
  for (let index = 0; index < 4; index++) {
    const player = await api("/lobby/join", null, { code: organizer.snapshot.codes.player, deviceId: randomUUID() });
    if (index % 2 === 0) {
      const state = await api("/lobby/teams", player.token, { name: index ? "Тест Бета" : "Тест Альфа", color: index ? "#8957f2" : "#087cff", avatar: 1, playerName: `Игрок ${index + 1}` });
      if (index === 0) alphaId = state.teams[0].id;
      if (index === 0) staff.PLAYER = player.token;
    } else {
      const state = await api("/auth/me", player.token);
      await api(`/lobby/teams/${state.teams[index === 1 ? 0 : 1].id}/join`, player.token, { playerName: `Игрок ${index + 1}` });
    }
  }
  for (let attempt = 0; attempt < 30; attempt++) {
    const state = await api("/auth/me", organizerToken);
    if (state.stations.filter((station) => station.enabled).every((station) => station.ready)) break;
    await wait(100);
  }
  await api("/admin/start", organizerToken, {});
  await api("/bank/loans", staff.BANK, { teamId: alphaId, principal: 5000, rate: 10, quarters: 2, delivery: "balance", idempotencyKey: randomUUID() });
  const catalog = await api("/construction/catalog", staff.CONSTRUCTION);
  await api("/construction/purchases", staff.CONSTRUCTION, { teamId: alphaId, objectTypeId: catalog.find((item) => item.code === "HOUSING").id, quantity: 1, unitPrice: 500, idempotencyKey: randomUUID() });
  await api("/science/patents", staff.PATENT_OFFICE, { teamId: alphaId, name: "Тестовая технология", industry: "Энергетика", duration: 2, coefficient: 1.2, idempotencyKey: randomUUID() });
  const medical = await api("/medicine/events", staff.MEDICINE, { idempotencyKey: randomUUID() });
  await api(`/medicine/events/${medical[0].id}`, staff.MEDICINE, { title: "Тестовое событие", duration: 2, teamIds: [alphaId] }, "PATCH");
  await api(`/medicine/events/${medical[0].id}/start`, staff.MEDICINE, {});
  await api(`/medicine/events/${medical[0].id}/finish`, staff.MEDICINE, {});
  await api("/tenders", organizerToken, { title: "Тестовый тендер", objectTypeCode: "HOUSING", deadlineQuarter: 2, requirements: [{ resourceCode: "HOUSING", requiredUnits: 5 }], idempotencyKey: randomUUID() });

  browser = spawn(process.env.SKYLINE_BROWSER_EXE ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", ["--headless=new", "--disable-gpu", "--no-first-run", "--remote-debugging-port=9228", `--user-data-dir=${join(tmpdir(), `skyline-live-${randomUUID()}`)}`, "about:blank"], { stdio: "ignore", windowsHide: true });
  for (let attempt = 0; attempt < 50; attempt++) { try { if ((await fetch(`${debug}/json/version`)).ok) break; } catch {} await wait(100); }
  const pages = await (await fetch(`${debug}/json/list`)).json();
  const page = pages.find((item) => item.type === "page");
  if (!page) throw new Error("Browser page not found");
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));
  let id = 0;
  const pending = new Map();
  const errors = [];
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
    const promise = pending.get(message.id);
    if (!promise) return;
    pending.delete(message.id);
    message.error ? promise.reject(new Error(message.error.message)) : promise.resolve(message.result);
  });
  function send(method, params = {}) { const requestId = ++id; return new Promise((resolve, reject) => { pending.set(requestId, { resolve, reject }); socket.send(JSON.stringify({ id: requestId, method, params })); }); }
  async function evaluate(expression) { return (await send("Runtime.evaluate", { expression, returnByValue: true })).result.value; }
  async function waitFor(expression) {
    for (let attempt = 0; attempt < 60; attempt++) { if (await evaluate(expression)) return; await wait(100); }
    const state = await evaluate("JSON.stringify({ path: location.pathname, text: document.body.textContent.slice(0, 700), cards: document.querySelectorAll('.construction-catalog-item').length })");
    throw new Error(`Timed out waiting for ${expression}: ${state}`);
  }
  await send("Page.enable"); await send("Runtime.enable"); await mkdir("artifacts", { recursive: true });
  await send("Page.navigate", { url: origin });
  await waitFor("document.readyState === 'complete'");
  async function visit(path, token, condition, label, mobile = false) {
    await send("Emulation.setDeviceMetricsOverride", { width: mobile ? 390 : 1280, height: mobile ? 844 : 900, deviceScaleFactor: 1, mobile });
    await evaluate(`localStorage.setItem('skyline-access-v1', ${JSON.stringify(JSON.stringify({ token, sessionId: organizer.snapshot.sessionId, role: token === organizerToken ? "ORGANIZER" : token === staff.PLAYER ? "PLAYER" : "STAFF" }))})`);
    await send("Page.navigate", { url: `${origin}${path}` });
    await waitFor(condition);
    const overflow = await evaluate("document.documentElement.scrollWidth > innerWidth");
    if (overflow) throw new Error(`${label}: horizontal overflow`);
    const screenshot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    await writeFile(`artifacts/live-${label}.png`, Buffer.from(screenshot.data, "base64"));
    console.log(`${label}: OK`);
  }
  await visit("/interfaces/bank", staff.BANK, "document.body.textContent.includes('Тест Альфа') && document.body.textContent.includes('6 000') && document.querySelector('header')?.textContent.includes('Квартал 1')", "bank");
  await visit("/interfaces/construction", staff.CONSTRUCTION, "document.body.textContent.includes('Тест Альфа') && [...document.querySelectorAll('.construction-catalog-item')].some((item) => item.textContent.includes('Жильё') && item.textContent.replace(/\\s/g, '').includes('2250') && item.textContent.includes('Построено всеми: 1')) && document.querySelector('header')?.textContent.includes('Квартал 1')", "construction");
  await visit("/interfaces/patents", staff.PATENT_OFFICE, "document.querySelector('.science-registered')?.textContent.includes('Тестовая технология')", "science");
  await visit("/interfaces/medicine", staff.MEDICINE, "document.querySelector('.medicine-history-row')?.textContent.includes('Тестовое событие')", "medicine");
  await visit("/interfaces/tenders-admin", organizerToken, "document.querySelector('.tenders-admin-list')?.textContent.includes('Тестовый тендер')", "tenders-admin");
  const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await db.connect();
  try {
    await db.query("UPDATE game_sessions SET starts_at = (NOW() AT TIME ZONE 'UTC') - INTERVAL '7 minutes' WHERE id = $1", [organizer.snapshot.sessionId]);
  } finally { await db.end(); }
  for (let attempt = 0; attempt < 30; attempt++) {
    if ((await api("/auth/me", staff.PLAYER)).currentQuarter === 2) break;
    await wait(100);
  }
  await visit("/interfaces/lobby/game", staff.PLAYER, "!!document.querySelector('.player-nav')", "player", true);
  await evaluate("document.querySelectorAll('.player-nav button')[1]?.click()");
  await waitFor("document.querySelector('.player-resource strong')?.textContent.includes('30') && document.querySelector('.player-resource-price')?.textContent.includes('15')");
  await evaluate("document.querySelector('.player-resource-sell')?.click()");
  await waitFor("document.querySelector('.player-dialog[aria-label^=\"Продажа:\"]') !== null");
  await evaluate("(() => { const slider = document.querySelector('.player-sale-slider'); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(slider, '3'); slider.dispatchEvent(new Event('input', { bubbles: true })); })()");
  await waitFor("document.querySelector('#player-sale-amount')?.value === '3'");
  await waitFor("document.querySelector('.player-dialog')?.textContent.replace(/\\s/g, '').includes('45₽')");
  const saleImage = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  await writeFile("artifacts/live-resource-sale.png", Buffer.from(saleImage.data, "base64"));
  await send("Emulation.setDeviceMetricsOverride", { width: 320, height: 568, deviceScaleFactor: 1, mobile: true });
  await wait(100);
  if (await evaluate("document.documentElement.scrollWidth > innerWidth")) throw new Error("resource-sale: horizontal overflow at 320px");
  const narrowSaleImage = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  await writeFile("artifacts/live-resource-sale-320.png", Buffer.from(narrowSaleImage.data, "base64"));
  await evaluate("document.querySelector('.player-dialog .player-buy')?.click()");
  await waitFor("!document.querySelector('.player-dialog') && document.querySelector('.player-resource strong')?.textContent.includes('27')");
  const soldState = await api("/auth/me", staff.PLAYER);
  if (soldState.teams.find((item) => item.id === alphaId).balance !== 5045) throw new Error("Resource sale did not credit the team");
  console.log("resource-sale: OK");
  await evaluate("document.querySelectorAll('.player-nav button')[3]?.click()");
  await waitFor("document.querySelector('.player-tender')?.textContent.includes('Тестовый тендер')");
  if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
  console.log("player-tenders: OK");
  socket.close();
} finally {
  for (const socket of sockets) socket.disconnect();
  browser?.kill();
  if (organizerToken) await api("/admin/finish", organizerToken, {}).catch(() => {});
}
