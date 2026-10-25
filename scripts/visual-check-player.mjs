import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { io } from "socket.io-client";

const origin = "http://127.0.0.1:8081";
const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const allDisabled = process.argv.includes("--all-disabled");
const profile = join(tmpdir(), `skyline-visual-${randomUUID()}`);
let organizerToken;
let browser;
const staffSockets = [];
async function api(path, token, body, method = "POST") {
  const response = await fetch(`${origin}/api${path}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const result = await response.json();
  if (!response.ok) throw new Error(`${path}: ${response.status} ${JSON.stringify(result)}`);
  return result;
}
async function pause(ms) { await new Promise((resolve) => setTimeout(resolve, ms)); }
async function inspect(width, height, token, sessionId, name) {
  const list = await (await fetch("http://127.0.0.1:9222/json/list")).json();
  const page = list.find((item) => item.type === "page");
  if (!page) throw new Error("Edge page not found");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (!pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    message.error ? reject(new Error(message.error.message)) : resolve(message.result);
  });
  function send(method, params = {}) { const requestId = ++id; return new Promise((resolve, reject) => { pending.set(requestId, { resolve, reject }); ws.send(JSON.stringify({ id: requestId, method, params })); }); }
  try {
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: true });
    await send("Page.navigate", { url: origin });
    await pause(1100);
    await send("Runtime.evaluate", { expression: `localStorage.setItem('skyline-access-v1', ${JSON.stringify(JSON.stringify({ token, sessionId, role: "PLAYER" }))})` });
    await send("Page.navigate", { url: `${origin}/interfaces/lobby/game` });
    await pause(2300);
    const check = await send("Runtime.evaluate", { expression: "JSON.stringify({ title: document.querySelector('h1')?.textContent, width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, viewportWidth: innerWidth, viewportHeight: innerHeight, nav: !!document.querySelector('.player-nav'), image: document.querySelector('.player-map-image')?.naturalWidth > 0, mapHeight: Math.round(document.querySelector('.player-map')?.getBoundingClientRect().height ?? 0), pins: [...document.querySelectorAll('.player-map-pin')].map((pin) => pin.textContent), openMapButton: !!document.querySelector('.player-map-open') })", returnByValue: true });
    const state = JSON.parse(check.result.value);
    if (!state.nav || !state.image || state.width > width || state.height > height || state.pins.length < 3 || state.openMapButton) throw new Error(`Invalid ${name} layout: ${JSON.stringify(state)}`);
    if (allDisabled && !state.pins.every((pin) => pin.includes("Пока закрыто"))) throw new Error(`${name}: disabled station markers have incorrect status`);
    await send("Runtime.evaluate", { expression: "document.querySelector('.player-map-pin')?.click()" });
    await pause(100);
    const detail = await send("Runtime.evaluate", { expression: "!!document.querySelector('.player-map-detail')", returnByValue: true });
    if (!detail.result.value) throw new Error(`${name}: map marker did not open`);
    await send("Runtime.evaluate", { expression: "document.querySelector('.player-map-detail button')?.click(); document.querySelectorAll('.player-nav button')[1]?.click()" });
    await pause(100);
    const assets = await send("Runtime.evaluate", { expression: "document.querySelector('.player-detail-scroll h2')?.textContent", returnByValue: true });
    if (assets.result.value !== "Ресурсы активов") throw new Error(`${name}: assets tab did not open: ${JSON.stringify(assets.result.value)}`);
    if (!allDisabled) {
      const before = await api("/auth/me", token, null, "GET");
      const catalog = await api("/market/catalog", token, null, "GET");
      const team = before.teams.find((item) => item.id === before.teamId);
      const housing = catalog.find((item) => item.code === "HOUSING");
      const price = housing.currentPrice;
      await send("Runtime.evaluate", { expression: "document.querySelectorAll('.player-nav button')[2]?.click()" });
      await pause(450);
      const marketItems = await send("Runtime.evaluate", { expression: "[...document.querySelectorAll('.player-market-object')].map((node) => node.textContent)", returnByValue: true });
      if (!marketItems.result.value?.some((item) => item.includes("15 ₽/ед."))) throw new Error(`${name}: current housing resource price missing from market`);
      await send("Runtime.evaluate", { expression: "[...document.querySelectorAll('.player-market-object')].find((node) => node.textContent.includes('Жилой комплекс'))?.querySelector('button')?.click()" });
      await pause(100);
      const opened = await send("Runtime.evaluate", { expression: "!!document.querySelector('.player-dialog .player-buy:not(:disabled)')", returnByValue: true });
      if (!opened.result.value) throw new Error(`${name}: housing purchase dialog did not open: ${JSON.stringify(marketItems.result.value)}`);
      await send("Runtime.evaluate", { expression: "document.querySelector('.player-dialog .player-buy')?.click()" });
      await pause(500);
      const after = await api("/auth/me", token, null, "GET");
      if (after.teams.find((item) => item.id === after.teamId).balance !== team.balance - price || after.assets.filter((asset) => asset.code === "HOUSING").reduce((sum, asset) => sum + asset.quantity, 0) !== before.assets.filter((asset) => asset.code === "HOUSING").reduce((sum, asset) => sum + asset.quantity, 0) + 1) throw new Error(`${name}: market purchase did not update team state`);
      const dialogClosed = await send("Runtime.evaluate", { expression: "!document.querySelector('.player-dialog')", returnByValue: true });
      if (!dialogClosed.result.value) throw new Error(`${name}: successful purchase dialog stayed open`);
      await send("Runtime.evaluate", { expression: "document.querySelectorAll('.player-nav button')[1]?.click()" });
      await pause(100);
      const visibleAsset = await send("Runtime.evaluate", { expression: "[...document.querySelectorAll('.player-object')].some((item) => item.textContent.includes('Жилой комплекс'))", returnByValue: true });
      if (!visibleAsset.result.value) throw new Error(`${name}: purchased housing missing from assets`);
    }
    await send("Runtime.evaluate", { expression: "document.querySelectorAll('.player-nav button')[0]?.click()" });
    await pause(400);
    const screenshot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    await mkdir("artifacts", { recursive: true });
    await writeFile(`artifacts/${name}.png`, Buffer.from(screenshot.data, "base64"));
    console.log(name, state);
  } finally { ws.close(); }
}

try {
  const organizer = await api("/admin/login", null, { code: "create" });
  organizerToken = organizer.token;
  for (const station of organizer.snapshot.stations) if (allDisabled || !["BANK", "ENTERPRISES", "MAYOR"].includes(station.type)) await api(`/admin/stations/${station.type}`, organizerToken, { enabled: false }, "PATCH");
  let bankToken;
  for (const type of allDisabled ? [] : ["BANK", "ENTERPRISES", "MAYOR"]) {
    const staff = await api("/admin/login", null, { code: organizer.snapshot.codes.staff[type] });
    if (type === "BANK") bankToken = staff.token;
    const socket = io(origin, { transports: ["websocket"], auth: { token: staff.token } });
    staffSockets.push(socket);
    await new Promise((resolve, reject) => { socket.once("connect", resolve); socket.once("connect_error", reject); });
  }
  let player;
  for (let index = 0; index < 4; index++) {
    const joined = await api("/lobby/join", null, { code: organizer.snapshot.codes.player, deviceId: randomUUID() });
    if (index === 0) player = joined;
    if (index % 2 === 0) await api("/lobby/teams", joined.token, { name: index ? "Команда Бета" : "Команда Альфа", color: index ? "#9e55e8" : "#087cff", avatar: 1, playerName: `Игрок ${index + 1}` });
    else {
      const state = await api("/auth/me", joined.token, null, "GET");
      await api(`/lobby/teams/${state.teams[index === 1 ? 0 : 1].id}/join`, joined.token, { playerName: `Игрок ${index + 1}` });
    }
  }
  await api("/admin/start", organizerToken);
  const state = await api("/auth/me", player.token, null, "GET");
  if (!allDisabled) await api("/atm/transactions", bankToken, { teamId: state.teamId, amount: 12500, type: "deposit", idempotencyKey: randomUUID() });
  browser = spawn(edge, ["--headless=new", "--disable-gpu", "--no-first-run", "--remote-debugging-port=9222", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore", windowsHide: true });
  for (let attempt = 0; attempt < 30; attempt++) { try { if ((await fetch("http://127.0.0.1:9222/json/version")).ok) break; } catch {} await pause(200); }
  await inspect(390, 844, player.token, organizer.snapshot.sessionId, `player${allDisabled ? "-disabled" : ""}-390x844`);
  await inspect(320, 568, player.token, organizer.snapshot.sessionId, `player${allDisabled ? "-disabled" : ""}-320x568`);
} finally {
  for (const socket of staffSockets) socket.disconnect();
  browser?.kill();
  if (organizerToken) await api("/admin/finish", organizerToken).catch(() => {});
}
