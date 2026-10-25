import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { io } from "socket.io-client";
import pg from "pg";

const base = process.argv[2] ?? "http://127.0.0.1:3101";
const sockets = [];
let organizerToken;
let expiringOrganizerToken;

async function request(path, { method = "GET", token, body, status } = {}) {
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  assert.equal(response.status, status ?? (method === "POST" ? 201 : 200), `${path}: HTTP ${response.status}`);
  return data;
}

async function postStatus(path, token, body) {
  const response = await fetch(`${base}/api${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.status;
}

function connect(token) {
  return new Promise((resolve, reject) => {
    const socket = io(base, { auth: { token }, transports: ["websocket"], reconnection: false });
    sockets.push(socket);
    const timeout = setTimeout(() => reject(new Error("Socket.IO connection timeout")), 5000);
    socket.once("connect", () => { clearTimeout(timeout); resolve(socket); });
    socket.once("connect_error", reject);
  });
}

async function until(check, timeoutMs = 5000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for synchronized state");
}

try {
  await request("/admin/login", { method: "POST", body: { code: "other" }, status: 401 });
  const organizer = await request("/admin/login", { method: "POST", body: { code: "create" } });
  organizerToken = organizer.token;
  assert.match(organizer.snapshot.codes.projector, /^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{6}$/);
  const projector = await request("/admin/projector", { token: organizerToken });
  await request("/projector/login", { method: "POST", body: { code: "NOPE00" }, status: 401 });
  const projectorLogin = await request("/projector/login", { method: "POST", body: { code: organizer.snapshot.codes.projector } });
  assert.equal(projectorLogin.token, projector.displayToken);
  assert.match(projector.displayToken, /^[A-Za-z0-9_-]{32,}$/);
  assert.equal(projector.screen, "overview");
  assert.ok(projector.screens.filter((screen) => screen.key.startsWith("resource:")).length >= 6);
  await request("/projector/state", { status: 401 });
  await request("/projector/state", { token: organizerToken, status: 401 });
  await request("/admin/projector", { token: projector.displayToken, status: 401 });
  const projected = await request("/admin/projector", { method: "PATCH", token: organizerToken, body: { screen: "resource:ENERGY" } });
  assert.equal(projected.screen, "resource:ENERGY");
  assert.equal((await request("/projector/state", { token: projector.displayToken })).screen, "resource:ENERGY");
  assert.ok((await request("/projector/data", { token: projector.displayToken })).resources.length >= 6);
  await request("/admin/projector", { method: "PATCH", token: organizerToken, body: { screen: "resource:OIL" }, status: 400 });
  assert.equal((await request("/admin/projector", { method: "PATCH", token: organizerToken, body: { automatic: true } })).automatic, true);
  assert.equal((await request("/projector/state", { token: projector.displayToken })).automatic, true);
  await request("/admin/projector", { method: "PATCH", token: organizerToken, body: { automatic: false } });
  assert.match(organizer.snapshot.codes.player, /^\d{5}$/);
  for (const code of Object.values(organizer.snapshot.codes.staff)) {
    assert.match(code, /^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{6}$/);
  }
  await request("/admin/login", { method: "POST", body: { code: "create" }, status: 409 });
  await request("/admin/settings", { method: "PATCH", token: organizerToken, body: { totalQuarters: 9, quarterDurationMin: 5 }, status: 400 });
  await request("/admin/settings", { method: "PATCH", token: organizerToken, body: { totalQuarters: 10, quarterDurationMin: 11 }, status: 400 });
  const configured = await request("/admin/settings", { method: "PATCH", token: organizerToken, body: { totalQuarters: 12, quarterDurationMin: 6 } });
  assert.equal(configured.totalQuarters, 12);
  assert.equal(configured.quarterDurationSec, 360);
  await request("/lobby/join", { method: "POST", body: { code: "999xx" }, status: 400 });

  const device1 = randomUUID();
  const device2 = randomUUID();
  const player1 = await request("/lobby/join", { method: "POST", body: { code: organizer.snapshot.codes.player, deviceId: device1 } });
  const player2 = await request("/lobby/join", { method: "POST", body: { code: organizer.snapshot.codes.player, deviceId: device2 } });
  await request("/lobby/join", { method: "POST", body: { code: organizer.snapshot.codes.player, deviceId: device1 }, status: 409 });
  await request("/lobby/teams", { method: "POST", token: player1.token, body: { name: "Альфа", color: "#087cff", avatar: 1 }, status: 400 });
  await request("/lobby/teams", { method: "POST", token: player1.token, body: { name: "Альфа", color: "#087cff", avatar: 1, playerName: "   " }, status: 400 });
  const teamState = await request("/lobby/teams", { method: "POST", token: player1.token, body: { name: "Альфа", color: "#087cff", avatar: 1, playerName: "  Алиса  " } });
  const team = teamState.teams[0];
  assert.equal(team.participants[0].displayName, "Алиса");
  await request(`/lobby/teams/${team.id}/join`, { method: "POST", token: player2.token, status: 400 });
  const playerSocket = await connect(player1.token);
  let joinedNameVisible = false;
  playerSocket.on("lobby:snapshot", (state) => {
    joinedNameVisible ||= state.teams.some((item) => item.id === team.id && item.participants?.some((person) => person.displayName === "Борис"));
  });
  await request(`/lobby/teams/${team.id}/join`, { method: "POST", token: player2.token, body: { playerName: "Борис" } });
  await until(() => joinedNameVisible);
  assert.deepEqual((await request("/auth/me", { token: organizerToken })).teams[0].participants.map((person) => person.displayName), ["Алиса", "Борис"]);
  await request(`/admin/players/${player2.participantId}/team`, { method: "PATCH", token: organizerToken, body: { teamId: team.id } });
  await request(`/admin/players/${player2.participantId}/disqualify`, { method: "POST", token: organizerToken });
  await request("/lobby/join", { method: "POST", body: { code: organizer.snapshot.codes.player, deviceId: device2 }, status: 403 });
  await request("/admin/start", { method: "POST", token: player1.token, status: 403 });
  await request("/admin/start", { method: "POST", token: organizerToken, status: 409 });

  for (const station of organizer.snapshot.stations) {
    if (!["BANK", "CONSTRUCTION", "PATENT_OFFICE", "MEDICINE"].includes(station.type)) await request(`/admin/stations/${station.type}`, { method: "PATCH", token: organizerToken, body: { enabled: false } });
  }
  const staff = await request("/admin/login", { method: "POST", body: { code: organizer.snapshot.codes.staff.BANK } });
  await request("/admin/login", { method: "POST", body: { code: organizer.snapshot.codes.staff.BANK }, status: 409 });
  assert.equal((await request("/auth/me", { token: staff.token })).stationType, "BANK");
  const adminSocket = await connect(organizerToken);
  const staffSocket = await connect(staff.token);
  await until(async () => (await request("/auth/me", { token: organizerToken })).stations.find((item) => item.type === "BANK").ready);
  await request("/admin/stations/BANK", { method: "PATCH", token: organizerToken, body: { enabled: false }, status: 409 });
  const kicked = await request("/admin/stations/BANK/kick", { method: "POST", token: organizerToken });
  assert.equal(kicked.stations.find((item) => item.type === "BANK").assigned, false);
  assert.equal(kicked.stations.find((item) => item.type === "BANK").ready, false);
  assert.notEqual(kicked.codes.staff.BANK, organizer.snapshot.codes.staff.BANK);
  await request("/auth/me", { token: staff.token, status: 401 });
  await request("/admin/login", { method: "POST", body: { code: organizer.snapshot.codes.staff.BANK }, status: 401 });
  await request("/admin/stations/BANK", { method: "PATCH", token: organizerToken, body: { enabled: false } });
  await request("/admin/stations/BANK", { method: "PATCH", token: organizerToken, body: { enabled: true } });
  const replacement = await request("/admin/login", { method: "POST", body: { code: kicked.codes.staff.BANK } });
  const replacementSocket = await connect(replacement.token);
  const construction = await request("/admin/login", { method: "POST", body: { code: organizer.snapshot.codes.staff.CONSTRUCTION } });
  await connect(construction.token);
  const science = await request("/admin/login", { method: "POST", body: { code: organizer.snapshot.codes.staff.PATENT_OFFICE } });
  await connect(science.token);
  const medicine = await request("/admin/login", { method: "POST", body: { code: organizer.snapshot.codes.staff.MEDICINE } });
  await connect(medicine.token);
  await until(async () => (await request("/auth/me", { token: organizerToken })).stations.find((item) => item.type === "BANK").ready);
  await until(async () => (await request("/auth/me", { token: organizerToken })).stations.find((item) => item.type === "CONSTRUCTION").ready);
  await until(async () => (await request("/auth/me", { token: organizerToken })).stations.find((item) => item.type === "PATENT_OFFICE").ready);
  await until(async () => (await request("/auth/me", { token: organizerToken })).stations.find((item) => item.type === "MEDICINE").ready);
  await request("/admin/start", { method: "POST", token: organizerToken, status: 409 });

  const player3 = await request("/lobby/join", { method: "POST", body: { code: organizer.snapshot.codes.player, deviceId: randomUUID() } });
  const secondTeam = await request("/lobby/teams", { method: "POST", token: player3.token, body: { name: "Бета", color: "#8957f2", avatar: 2, playerName: "Вера" } });
  await request("/admin/start", { method: "POST", token: organizerToken, status: 409 });
  const player4 = await request("/lobby/join", { method: "POST", body: { code: organizer.snapshot.codes.player, deviceId: randomUUID() } });
  await request(`/lobby/teams/${secondTeam.teams[1].id}/join`, { method: "POST", token: player4.token, body: { playerName: "Глеб" } });
  await request("/admin/start", { method: "POST", token: organizerToken, status: 409 });
  const player5 = await request("/lobby/join", { method: "POST", body: { code: organizer.snapshot.codes.player, deviceId: randomUUID() } });
  await request(`/lobby/teams/${team.id}/join`, { method: "POST", token: player5.token, body: { playerName: "Дина" } });

  const started = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Player did not receive match:started")), 5000);
    playerSocket.once("match:started", (state) => { clearTimeout(timeout); resolve(state); });
  });
  const active = await request("/admin/start", { method: "POST", token: organizerToken });
  const event = await started;
  assert.equal(active.status, "ACTIVE");
  assert.equal(event.status, "ACTIVE");
  assert.equal(event.startsAt, active.startsAt);
  assert.deepEqual(await request("/science/patents", { token: science.token }), []);
  await request("/science/patents", { token: medicine.token, status: 403 });
  const patentInput = { teamId: team.id, name: "Накопитель энергии", industry: "Энергетика", duration: 2, coefficient: 1.2, idempotencyKey: randomUUID() };
  assert.equal((await request("/science/patents", { method: "POST", token: science.token, body: patentInput })).length, 1);
  assert.equal((await request("/science/patents", { method: "POST", token: science.token, body: patentInput })).length, 1);
  await request("/science/patents", { method: "POST", token: science.token, body: { ...patentInput, name: "Другой патент" }, status: 409 });
  assert.equal((await request("/science/patents", { method: "POST", token: science.token, body: { ...patentInput, name: "Новая технология", idempotencyKey: randomUUID() } })).length, 2);
  await request("/science/patents", { method: "POST", token: science.token, body: { ...patentInput, name: "Третий патент", idempotencyKey: randomUUID() }, status: 409 });
  assert.deepEqual(await request("/medicine/events", { token: medicine.token }), []);
  const medicalKey = randomUUID();
  const medicalDraft = await request("/medicine/events", { method: "POST", token: medicine.token, body: { idempotencyKey: medicalKey } });
  assert.equal(medicalDraft.length, 1);
  assert.equal((await request("/medicine/events", { method: "POST", token: medicine.token, body: { idempotencyKey: medicalKey } })).length, 1);
  await request(`/medicine/events/${medicalDraft[0].id}/start`, { method: "POST", token: medicine.token, status: 409 });
  const configuredMedical = await request(`/medicine/events/${medicalDraft[0].id}`, { method: "PATCH", token: medicine.token, body: { title: "Вспышка заболевания", duration: 2, teamIds: [team.id] } });
  assert.equal(configuredMedical[0].teamIds[0], team.id);
  await request(`/medicine/events/${medicalDraft[0].id}`, { method: "PATCH", token: medicine.token, body: { title: "Вспышка заболевания", duration: 2, teamIds: [randomUUID()] }, status: 400 });
  assert.equal((await request(`/medicine/events/${medicalDraft[0].id}/start`, { method: "POST", token: medicine.token }))[0].status, "active");
  await request(`/medicine/events/${medicalDraft[0].id}`, { method: "PATCH", token: medicine.token, body: { title: "Изменено", duration: 1, teamIds: [] }, status: 409 });
  assert.equal((await request(`/medicine/events/${medicalDraft[0].id}/finish`, { method: "POST", token: medicine.token }))[0].status, "finished");
  await request("/admin/settings", { method: "PATCH", token: organizerToken, body: { totalQuarters: 10, quarterDurationMin: 5 }, status: 409 });
  const operation = { teamId: team.id, amount: 1500, type: "deposit", idempotencyKey: randomUUID() };
  const deposited = await request("/atm/transactions", { method: "POST", token: replacement.token, body: operation });
  assert.equal(deposited.teams.find((item) => item.id === team.id).balance, 1500);
  assert.equal(deposited.transactions[0].type, "deposit");
  const duplicate = await request("/atm/transactions", { method: "POST", token: replacement.token, body: operation });
  assert.equal(duplicate.teams.find((item) => item.id === team.id).balance, 1500);
  await request("/atm/transactions", { method: "POST", token: replacement.token, body: { ...operation, amount: 1000 }, status: 409 });
  await request("/atm/transactions", { method: "POST", token: replacement.token, body: { ...operation, amount: 750, idempotencyKey: randomUUID() }, status: 400 });
  await request("/atm/transactions", { method: "POST", token: replacement.token, body: { ...operation, type: "withdraw", amount: 2000, idempotencyKey: randomUUID() }, status: 409 });
  const withdrawn = await request("/atm/transactions", { method: "POST", token: replacement.token, body: { ...operation, type: "withdraw", amount: 500, idempotencyKey: randomUUID() } });
  assert.equal(withdrawn.teams.find((item) => item.id === team.id).balance, 1000);
  assert.equal(withdrawn.transactions[0].type, "withdraw");
  assert.equal((await request("/auth/me", { token: player1.token })).teams.find((item) => item.id === team.id).balance, 1000);
  assert.equal((await request("/auth/me", { token: player1.token })).transactions[0].type, "withdraw");
  assert.equal((await request("/auth/me", { token: player1.token })).teamId, team.id);
  assert.equal((await request("/auth/me", { token: replacement.token })).status, "ACTIVE");
  const loanInput = { teamId: team.id, principal: 50000, rate: 10, quarters: 4, delivery: "balance", idempotencyKey: randomUUID() };
  await request("/bank/loans", { token: construction.token, status: 403 });
  const [issued, issuedReplay] = await Promise.all([request("/bank/loans", { method: "POST", token: replacement.token, body: loanInput }), request("/bank/loans", { method: "POST", token: replacement.token, body: loanInput })]);
  assert.equal(issuedReplay.length, 1);
  assert.equal(issued[0].total, 70000);
  assert.equal(issued[0].paymentPerQuarter, 17500);
  assert.equal(issued[0].remaining, 55000);
  assert.equal((await request("/auth/me", { token: player1.token })).teams.find((item) => item.id === team.id).balance, 51000);
  await request("/bank/loans", { method: "POST", token: replacement.token, body: loanInput });
  await request("/bank/loans", { method: "POST", token: replacement.token, body: { ...loanInput, idempotencyKey: randomUUID() }, status: 409 });
  await request("/bank/loans", { method: "POST", token: replacement.token, body: { ...loanInput, principal: 50500, idempotencyKey: loanInput.idempotencyKey }, status: 409 });
  const payment = { amount: 25000, idempotencyKey: randomUUID() };
  const repaid = await request(`/bank/loans/${issued[0].id}/payments`, { method: "POST", token: replacement.token, body: payment });
  assert.equal(repaid[0].remaining, 30000);
  await request(`/bank/loans/${issued[0].id}/payments`, { method: "POST", token: replacement.token, body: payment });
  await request(`/bank/loans/${issued[0].id}/payments`, { method: "POST", token: replacement.token, body: { amount: 55001, idempotencyKey: randomUUID() }, status: 409 });
  assert.equal((await request("/auth/me", { token: player1.token })).loan.remaining, 30000);
  assert.equal((await request("/auth/me", { token: player1.token })).teams.find((item) => item.id === team.id).balance, 51000);
  const cashLoan = await request("/bank/loans", { method: "POST", token: replacement.token, body: { teamId: secondTeam.teams[1].id, principal: 500, rate: 0, quarters: 1, delivery: "cash", idempotencyKey: randomUUID() } });
  assert.equal(cashLoan.find((item) => item.teamId === secondTeam.teams[1].id).remaining, 500);
  assert.equal((await request("/auth/me", { token: organizerToken })).teams.find((item) => item.id === secondTeam.teams[1].id).balance, 0);
  const marketCatalog = await request("/market/catalog", { token: player3.token });
  assert.equal(marketCatalog.length >= 6, true);
  const housing = marketCatalog.find((item) => item.code === "HOUSING");
  assert.equal(housing.currentPrice, 2000);
  assert.equal("basePrice" in housing, false);
  assert.equal("priceStep" in housing, false);
  assert.deepEqual(Object.fromEntries(marketCatalog.filter((item) => ["HOUSING", "ENERGY", "GAS", "METAL", "WOOD", "COAL"].includes(item.code)).map((item) => [item.code, item.yields[0].currentUnitPrice])), { COAL: 55, ENERGY: 60, GAS: 80, HOUSING: 15, METAL: 140, WOOD: 20 });
  await request("/market/purchases", { method: "POST", token: player3.token, body: { objectTypeId: housing.id, quantity: 1, idempotencyKey: randomUUID() }, status: 409 });
  await request("/atm/transactions", { method: "POST", token: replacement.token, body: { teamId: secondTeam.teams[1].id, amount: 5000, type: "deposit", idempotencyKey: randomUUID() } });
  const marketPurchase = { objectTypeId: housing.id, quantity: 1, idempotencyKey: randomUUID() };
  const bought = await request("/market/purchases", { method: "POST", token: player3.token, body: marketPurchase });
  assert.equal(bought.teams.find((item) => item.id === secondTeam.teams[1].id).balance, 3000);
  assert.equal(bought.assets.find((asset) => asset.code === "HOUSING").quantity, 1);
  assert.equal((await request("/market/catalog", { token: player3.token })).find((item) => item.code === "HOUSING").currentPrice, 2250);
  assert.equal((await request("/market/purchases", { method: "POST", token: player3.token, body: marketPurchase })).teams.find((item) => item.id === secondTeam.teams[1].id).balance, 3000);
  const alphaCatalog = await request("/market/catalog", { token: player1.token });
  assert.equal(alphaCatalog.find((item) => item.code === "HOUSING").builtCount, 1);
  assert.equal(alphaCatalog.find((item) => item.code === "HOUSING").currentPrice, 2250);
  const alphaMarketPurchase = { objectTypeId: housing.id, quantity: 1, idempotencyKey: randomUUID() };
  const [alphaBought, alphaReplay] = await Promise.all([request("/market/purchases", { method: "POST", token: player1.token, body: alphaMarketPurchase }), request("/market/purchases", { method: "POST", token: player1.token, body: alphaMarketPurchase })]);
  assert.equal(alphaBought.teams.find((item) => item.id === team.id).balance, 48750);
  assert.equal(alphaReplay.teams.find((item) => item.id === team.id).balance, 48750);
  assert.equal(alphaBought.assets.find((asset) => asset.code === "HOUSING").yields[0].unitsPerQuarter, 30);
  assert.equal(alphaBought.loan.remaining, 30000);
  const competingMarket = await Promise.all([
    postStatus("/market/purchases", player3.token, { objectTypeId: housing.id, quantity: 1, idempotencyKey: randomUUID() }),
    postStatus("/market/purchases", player3.token, { objectTypeId: housing.id, quantity: 1, idempotencyKey: randomUUID() }),
  ]);
  assert.deepEqual(competingMarket.sort(), [201, 409]);
  assert.equal((await request("/market/catalog", { token: player3.token })).find((item) => item.code === "HOUSING").currentPrice, 2750);
  assert.equal((await request("/auth/me", { token: player3.token })).teams.find((item) => item.id === secondTeam.teams[1].id).balance, 500);
  const latePlayer = await request("/lobby/join", { method: "POST", body: { code: organizer.snapshot.codes.player, deviceId: randomUUID() } });
  await request("/lobby/teams", { method: "POST", token: latePlayer.token, body: { name: "Поздняя", color: "#087cff", avatar: 1, playerName: "Егор" }, status: 409 });
  const lateState = await request(`/lobby/teams/${team.id}/join`, { method: "POST", token: latePlayer.token, body: { playerName: "Егор" } });
  assert.equal(lateState.status, "ACTIVE");
  assert.equal(lateState.teams.find((item) => item.id === team.id).participants.some((person) => person.displayName === "Егор"), true);
  assert.equal(adminSocket.connected && playerSocket.connected && replacementSocket.connected, true);
  assert.equal(staffSocket.connected, false);
  const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await db.connect();
  try {
    const displayData = await request("/projector/data", { token: projector.displayToken });
    assert.ok(displayData.teams.find((item) => item.id === team.id).assetsCount >= 1);
    await request("/admin/projector", { method: "PATCH", token: organizerToken, body: { screen: "overview", automatic: true } });
    await db.query("UPDATE projector_states SET changed_at = (NOW() AT TIME ZONE 'UTC') - INTERVAL '16 seconds' WHERE session_id = $1", [organizer.snapshot.sessionId]);
    const autoScreen = await request("/projector/state", { token: projector.displayToken });
    assert.equal(autoScreen.screen, projector.screens[1].key);
    const stopped = await request("/admin/projector", { method: "PATCH", token: organizerToken, body: { automatic: false } });
    assert.equal(stopped.screen, autoScreen.screen);
    const resourceId = "a0a10000-0000-4000-8000-000000000001";
    const objectTypeId = "a0a10000-0000-4000-8000-000000000002";
    await db.query("INSERT INTO resource_types (id, code, label, base_unit_price) VALUES ($1, $2, 'Энергия', 60) ON CONFLICT DO NOTHING", [resourceId, `ENERGY_${resourceId}`]);
    await db.query("UPDATE resource_types SET base_unit_price = 60 WHERE id = $1", [resourceId]);
    await db.query("INSERT INTO object_types (id, code, category, purchase_base_price, production_rules_json) VALUES ($1, $2, 'Энергетика', 1000, '{}'::jsonb) ON CONFLICT DO NOTHING", [objectTypeId, `PLANT_${objectTypeId}`]);
    await db.query("INSERT INTO object_yields (object_type_id, resource_type_id, units_per_quarter) VALUES ($1, $2, 3) ON CONFLICT DO NOTHING", [objectTypeId, resourceId]);
    const purchase = { teamId: team.id, objectTypeId, quantity: 2, unitPrice: 1250, idempotencyKey: randomUUID() };
    assert.equal((await request("/construction/catalog", { token: construction.token })).some((item) => item.id === objectTypeId), true);
    await request("/construction/purchases", { method: "POST", token: construction.token, body: { ...purchase, unitPrice: 1200 }, status: 400 });
    await request("/construction/purchases", { method: "POST", token: replacement.token, body: purchase, status: 403 });
    const [early, earlyReplay] = await Promise.all([request("/construction/purchases", { method: "POST", token: construction.token, body: purchase }), request("/construction/purchases", { method: "POST", token: construction.token, body: purchase })]);
    assert.equal(early.teams.find((item) => item.id === team.id).assetsCount, 3);
    assert.equal(earlyReplay.teams.find((item) => item.id === team.id).assetsCount, 3);
    assert.equal(early.teams.find((item) => item.id === team.id).balance, 48750);
    await request("/construction/purchases", { method: "POST", token: construction.token, body: purchase });
    await request("/construction/purchases", { method: "POST", token: construction.token, body: { ...purchase, quantity: 4 }, status: 409 });
    assert.equal((await request("/auth/me", { token: player1.token })).assets[0].firstProductionQuarter, 1);
    await db.query("UPDATE game_sessions SET starts_at = (NOW() AT TIME ZONE 'UTC') - INTERVAL '4 minutes' WHERE id = $1", [organizer.snapshot.sessionId]);
    const late = await request("/construction/purchases", { method: "POST", token: construction.token, body: { ...purchase, quantity: 1, unitPrice: 1500, idempotencyKey: randomUUID() } });
    assert.equal(late.teams.find((item) => item.id === team.id).assetsCount, 4);
    assert.equal(late.teams.find((item) => item.id === team.id).balance, 48750);
    assert.deepEqual((await request("/auth/me", { token: player1.token })).assets.map((asset) => asset.firstProductionQuarter), [1, 1, 2]);
    await db.query("UPDATE game_sessions SET starts_at = (NOW() AT TIME ZONE 'UTC') - INTERVAL '7 minutes' WHERE id = $1", [organizer.snapshot.sessionId]);
    await until(async () => (await request("/auth/me", { token: player1.token })).currentQuarter === 2, 6000);
    const quarterTwo = await request("/auth/me", { token: player1.token });
    assert.equal(quarterTwo.resources.find((item) => item.code === `ENERGY_${resourceId}`).quantity, 6);
    assert.equal(quarterTwo.resources.find((item) => item.code === "HOUSING").quantity, 30);
    const resourceOffers = await request("/market/resources", { token: player3.token });
    assert.deepEqual(resourceOffers.find((item) => item.code === "HOUSING"), { code: "HOUSING", label: "Жильё", quantity: 60, currentUnitPrice: 15 });
    assert.equal("baseUnitPrice" in resourceOffers[0], false);
    const sale = { resourceCode: "HOUSING", quantity: 5, expectedUnitPrice: 15, idempotencyKey: randomUUID() };
    const [sold, soldReplay] = await Promise.all([
      request("/market/resources/sales", { method: "POST", token: player3.token, body: sale }),
      request("/market/resources/sales", { method: "POST", token: player3.token, body: sale }),
    ]);
    assert.equal(sold.resources.find((item) => item.code === "HOUSING").quantity, 55);
    assert.equal(soldReplay.teams.find((item) => item.id === secondTeam.teams[1].id).balance, 575);
    await request("/market/resources/sales", { method: "POST", token: player3.token, body: { ...sale, quantity: 6 } , status: 409 });
    await request("/market/resources/sales", { method: "POST", token: construction.token, body: sale, status: 403 });
    await db.query("UPDATE resource_prices SET current_unit_price = 20 WHERE session_id = $1 AND resource_type_id = (SELECT id FROM resource_types WHERE code = 'HOUSING')", [organizer.snapshot.sessionId]);
    await request("/market/resources/sales", { method: "POST", token: player3.token, body: { ...sale, idempotencyKey: randomUUID() }, status: 409 });
    await request("/market/resources/sales", { method: "POST", token: player3.token, body: { ...sale, quantity: 60, expectedUnitPrice: 20, idempotencyKey: randomUUID() }, status: 409 });
    const competingSales = await Promise.all([
      postStatus("/market/resources/sales", player3.token, { resourceCode: "HOUSING", quantity: 50, expectedUnitPrice: 20, idempotencyKey: randomUUID() }),
      postStatus("/market/resources/sales", player3.token, { resourceCode: "HOUSING", quantity: 50, expectedUnitPrice: 20, idempotencyKey: randomUUID() }),
    ]);
    assert.deepEqual(competingSales.sort(), [201, 409]);
    assert.equal((await request("/market/resources", { token: player3.token })).find((item) => item.code === "HOUSING").quantity, 5);
    assert.equal((await request("/auth/me", { token: player3.token })).teams.find((item) => item.id === secondTeam.teams[1].id).balance, 1575);
    const playerPartPayment = await request(`/bank/loans/${cashLoan.find((item) => item.teamId === secondTeam.teams[1].id).id}/payments`, { method: "POST", token: player3.token, body: { amount: 200, idempotencyKey: randomUUID() } });
    assert.equal(playerPartPayment.loan.remaining, 300);
    const playerFinalPayment = await request(`/bank/loans/${playerPartPayment.loan.id}/payments`, { method: "POST", token: player3.token, body: { amount: 300, idempotencyKey: randomUUID() } });
    assert.equal(playerFinalPayment.loan, null);
    assert.equal(playerFinalPayment.teams.find((item) => item.id === secondTeam.teams[1].id).balance, 1075);
    await db.query("UPDATE game_sessions SET starts_at = (NOW() AT TIME ZONE 'UTC') - INTERVAL '13 minutes' WHERE id = $1", [organizer.snapshot.sessionId]);
    await until(async () => (await request("/auth/me", { token: player1.token })).currentQuarter === 3, 6000);
    const quarterThree = await request("/auth/me", { token: player1.token });
    assert.equal(quarterThree.resources.find((item) => item.code === `ENERGY_${resourceId}`).quantity, 15);
    assert.equal(quarterThree.resources.find((item) => item.code === "HOUSING").quantity, 60);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    assert.equal((await request("/auth/me", { token: player1.token })).resources.find((item) => item.code === `ENERGY_${resourceId}`).quantity, 15);
    await db.query("INSERT INTO resource_prices (session_id, resource_type_id, current_unit_price) VALUES ($1, $2, 60) ON CONFLICT (session_id, resource_type_id) DO UPDATE SET current_unit_price = 60", [organizer.snapshot.sessionId, resourceId]);
    const tenderInput = { title: "Энергетический проект", objectTypeCode: "ENERGY", deadlineQuarter: 4, requirements: [{ resourceCode: `ENERGY_${resourceId}`, requiredUnits: 5 }], idempotencyKey: randomUUID() };
    const createdTenders = await request("/tenders", { method: "POST", token: organizerToken, body: tenderInput });
    const tenderId = createdTenders[0].id;
    assert.equal(createdTenders[0].status, "ACTIVE");
    await request("/tenders", { method: "POST", token: organizerToken, body: tenderInput });
    await request("/tenders", { method: "POST", token: organizerToken, body: { ...tenderInput, requirements: [{ ...tenderInput.requirements[0], requiredUnits: 6 }] }, status: 409 });
    const contribution = { resourceCode: `ENERGY_${resourceId}`, quantity: 3, idempotencyKey: randomUUID() };
    const donated = await request(`/tenders/${tenderId}/contributions`, { method: "POST", token: player1.token, body: contribution });
    assert.equal(donated[0].requirements[0].collected, 3);
    assert.equal(donated[0].requirements[0].team, 3);
    assert.equal((await request("/auth/me", { token: player1.token })).resources.find((item) => item.code === `ENERGY_${resourceId}`).quantity, 12);
    assert.equal((await request("/auth/me", { token: player1.token })).loan.remaining, 36000);
    await request(`/tenders/${tenderId}/contributions`, { method: "POST", token: player1.token, body: contribution });
    await request(`/tenders/${tenderId}/contributions`, { method: "POST", token: player1.token, body: { ...contribution, idempotencyKey: randomUUID() }, status: 409 });
    const finalPayment = { amount: 36000, idempotencyKey: randomUUID() };
    const [settled, settledReplay] = await Promise.all([request(`/bank/loans/${issued[0].id}/payments`, { method: "POST", token: replacement.token, body: finalPayment }), request(`/bank/loans/${issued[0].id}/payments`, { method: "POST", token: replacement.token, body: finalPayment })]);
    assert.equal(settled.find((item) => item.id === issued[0].id).remaining, 0);
    assert.equal(settledReplay.find((item) => item.id === issued[0].id).remaining, 0);
    const finalPlayer = await request("/auth/me", { token: player1.token });
    assert.equal(finalPlayer.loan, null);
    assert.equal(finalPlayer.teams.find((item) => item.id === team.id).balance, 48750);
    assert.equal(finalPlayer.resources.find((item) => item.code === `ENERGY_${resourceId}`).quantity, 12);
    const ledger = await db.query("SELECT COALESCE(SUM(amount_signed), 0)::int AS balance FROM ledger_entries WHERE session_id = $1 AND team_id = $2", [organizer.snapshot.sessionId, team.id]);
    assert.equal(ledger.rows[0].balance, 48750);
    const production = await db.query("SELECT COALESCE(SUM(produced_units), 0)::int AS produced FROM production_lines WHERE team_id = $1 AND resource_type_id = $2", [team.id, resourceId]);
    assert.equal(production.rows[0].produced, 15);
    const closedTenders = await request(`/tenders/${tenderId}/close`, { method: "POST", token: organizerToken });
    assert.equal(closedTenders[0].status, "CLOSED");
    assert.equal((await request("/auth/me", { token: player1.token })).teams.find((item) => item.id === team.id).balance, 48885);
    await request(`/tenders/${tenderId}/contributions`, { method: "POST", token: player1.token, body: { ...contribution, quantity: 1, idempotencyKey: randomUUID() }, status: 409 });
    const raceTender = await request("/tenders", { method: "POST", token: organizerToken, body: { title: "Конкурентный вклад", deadlineQuarter: 4, requirements: [{ resourceCode: `ENERGY_${resourceId}`, requiredUnits: 1 }], idempotencyKey: randomUUID() } });
    const competingContributions = await Promise.all([
      postStatus(`/tenders/${raceTender[0].id}/contributions`, player1.token, { resourceCode: `ENERGY_${resourceId}`, quantity: 1, idempotencyKey: randomUUID() }),
      postStatus(`/tenders/${raceTender[0].id}/contributions`, player1.token, { resourceCode: `ENERGY_${resourceId}`, quantity: 1, idempotencyKey: randomUUID() }),
    ]);
    assert.deepEqual(competingContributions.sort(), [201, 409]);
    assert.equal((await request("/auth/me", { token: player1.token })).teams.find((item) => item.id === team.id).balance, 48960);
    const expiringTender = await request("/tenders", { method: "POST", token: organizerToken, body: { title: "Незавершённый тендер", deadlineQuarter: 4, requirements: [{ resourceCode: `ENERGY_${resourceId}`, requiredUnits: 5 }], idempotencyKey: randomUUID() } });
    await request(`/tenders/${expiringTender[0].id}/contributions`, { method: "POST", token: player1.token, body: { resourceCode: `ENERGY_${resourceId}`, quantity: 2, idempotencyKey: randomUUID() } });
    assert.equal((await request("/auth/me", { token: player1.token })).resources.find((item) => item.code === `ENERGY_${resourceId}`).quantity, 9);
    const beforeCashPrice = await db.query("SELECT o.purchase_base_price, p.current_price FROM object_types o JOIN object_prices p ON p.object_type_id = o.id WHERE o.code = 'HOUSING' AND p.session_id = $1", [organizer.snapshot.sessionId]);
    assert.deepEqual(beforeCashPrice.rows[0], { purchase_base_price: 2000, current_price: 2750 });
    await request("/construction/purchases", { method: "POST", token: construction.token, body: { teamId: team.id, objectTypeId: housing.id, quantity: 1, unitPrice: 500, idempotencyKey: randomUUID() } });
    assert.equal((await request("/market/catalog", { token: player3.token })).find((item) => item.code === "HOUSING").currentPrice, 3000);
    assert.equal((await request("/auth/me", { token: player1.token })).teams.find((item) => item.id === team.id).balance, 48960);
    await db.query("UPDATE object_prices SET current_price = 4000 WHERE session_id = $1 AND object_type_id = $2", [organizer.snapshot.sessionId, housing.id]);
    await db.query("UPDATE resource_prices SET current_unit_price = 75 WHERE session_id = $1 AND resource_type_id = (SELECT id FROM resource_types WHERE code = 'ENERGY')", [organizer.snapshot.sessionId]);
    const repricedCatalog = await request("/market/catalog", { token: player1.token });
    assert.equal(repricedCatalog.find((item) => item.code === "HOUSING").currentPrice, 4000);
    assert.equal(repricedCatalog.find((item) => item.code === "ENERGY").yields[0].currentUnitPrice, 75);
    const repricedPurchase = await request("/market/purchases", { method: "POST", token: player1.token, body: { objectTypeId: housing.id, quantity: 1, idempotencyKey: randomUUID() } });
    assert.equal(repricedPurchase.teams.find((item) => item.id === team.id).balance, 44960);
    assert.equal((await request("/market/catalog", { token: player1.token })).find((item) => item.code === "HOUSING").currentPrice, 4250);
    assert.equal((await db.query("SELECT purchase_base_price FROM object_types WHERE id = $1", [housing.id])).rows[0].purchase_base_price, 2000);
    const bulkPurchase = { teamId: team.id, objectTypeId, quantity: 100, unitPrice: 500, idempotencyKey: randomUUID() };
    await request("/construction/purchases", { method: "POST", token: construction.token, body: { ...bulkPurchase, quantity: 101 }, status: 400 });
    await request("/construction/purchases", { method: "POST", token: construction.token, body: bulkPurchase });
    assert.equal((await request("/auth/me", { token: player1.token })).assets.some((asset) => asset.quantity === 100 && asset.id), true);
    await db.query("UPDATE game_sessions SET starts_at = (NOW() AT TIME ZONE 'UTC') - INTERVAL '73 minutes' WHERE id = $1", [organizer.snapshot.sessionId]);
    await until(async () => (await request("/auth/me", { token: player1.token })).currentQuarter === 12, 6000);
    assert.equal((await request("/auth/me", { token: player1.token })).teams.find((item) => item.id === team.id).balance, 45050);
    assert.equal((await request("/auth/me", { token: player1.token })).status, "ACTIVE");
    await db.query("UPDATE game_sessions SET starts_at = (NOW() AT TIME ZONE 'UTC') - INTERVAL '131 minutes' WHERE id = $1", [organizer.snapshot.sessionId]);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    assert.equal((await request("/auth/me", { token: player1.token })).status, "ACTIVE");
    await db.query("UPDATE game_sessions SET starts_at = (NOW() AT TIME ZONE 'UTC') - INTERVAL '133 minutes' WHERE id = $1", [organizer.snapshot.sessionId]);
    await until(async () => (await request("/auth/me", { token: player1.token })).status === "FINISHED", 6000);
    const finishedPlayer = await request("/auth/me", { token: player1.token });
    const finishedStaff = await request("/auth/me", { token: replacement.token });
    assert.equal(finishedPlayer.results.length, 2);
    assert.deepEqual(finishedStaff.results, finishedPlayer.results);
    assert.deepEqual((await request("/auth/me", { token: organizerToken })).results, finishedPlayer.results);
    assert.deepEqual((await request("/auth/me", { token: organizerToken })).resultHistory, finishedPlayer.resultHistory);
    assert.equal(finishedPlayer.resultHistory.length, 28);
    assert.equal(finishedPlayer.resultHistory.filter((item) => item.phase === "START").length, 2);
    assert.equal(finishedPlayer.resultHistory.filter((item) => item.phase === "QUARTER").length, 24);
    assert.equal(finishedPlayer.resultHistory.filter((item) => item.phase === "FINAL").length, 2);
    assert.deepEqual(finishedStaff.resultHistory, finishedPlayer.resultHistory);
    const savedAutoScores = await db.query("SELECT phase, quarter_number, team_id, score FROM match_score_snapshots WHERE session_id = $1 ORDER BY quarter_number, phase, team_id", [organizer.snapshot.sessionId]);
    assert.equal(savedAutoScores.rows.length, 28);
    assert.equal(savedAutoScores.rows.filter((item) => item.phase === "FINAL").length, 2);
    assert.equal(finishedPlayer.results[0].isWinner, true);
    assert.equal(finishedPlayer.results[0].rank, 1);
    for (const result of finishedPlayer.results) {
      assert.equal(result.score, result.buildingPoints + result.resourcePoints - Math.max(0, result.debt - result.balance));
      assert.equal(result.debtDeduction, Math.max(0, result.debt - result.balance));
    }
    await db.query("UPDATE object_prices SET current_price = current_price + 10000 WHERE session_id = $1", [organizer.snapshot.sessionId]);
    await db.query("UPDATE resource_prices SET current_unit_price = current_unit_price + 1000 WHERE session_id = $1", [organizer.snapshot.sessionId]);
    await db.query("UPDATE teams SET electronic_balance = 0 WHERE session_id = $1", [organizer.snapshot.sessionId]);
    await db.query("UPDATE resource_stocks SET quantity = 0 WHERE session_id = $1", [organizer.snapshot.sessionId]);
    assert.deepEqual((await request("/auth/me", { token: player1.token })).results, finishedPlayer.results);
    assert.deepEqual((await request("/auth/me", { token: player1.token })).resultHistory, finishedPlayer.resultHistory);
    await request("/admin/finish", { method: "POST", token: organizerToken });
    assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM match_score_snapshots WHERE session_id = $1", [organizer.snapshot.sessionId])).rows[0].count, 28);
    const expiring = await request("/admin/login", { method: "POST", body: { code: "create" } });
    expiringOrganizerToken = expiring.token;
    assert.equal(expiring.snapshot.status, "WAITING");
    await db.query("UPDATE game_sessions SET created_at = (NOW() AT TIME ZONE 'UTC') - INTERVAL '61 minutes' WHERE id = $1", [expiring.snapshot.sessionId]);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    assert.equal((await request("/auth/me", { token: expiring.token })).status, "WAITING");
    await request("/admin/finish", { method: "POST", token: expiring.token });
    const next = await request("/admin/login", { method: "POST", body: { code: "create" } });
    const nextHousingPrice = await db.query("SELECT p.current_price, r.current_unit_price FROM object_prices p JOIN object_types o ON o.id = p.object_type_id JOIN resource_types t ON t.code = o.code JOIN resource_prices r ON r.session_id = p.session_id AND r.resource_type_id = t.id WHERE p.session_id = $1 AND o.code = 'HOUSING'", [next.snapshot.sessionId]);
    assert.deepEqual(nextHousingPrice.rows[0], { current_price: 2000, current_unit_price: 15 });
    const manualPlayers = await Promise.all(Array.from({ length: 4 }, () => request("/lobby/join", { method: "POST", body: { code: next.snapshot.codes.player, deviceId: randomUUID() } })));
    const manualFirst = await request("/lobby/teams", { method: "POST", token: manualPlayers[0].token, body: { name: "Manual Alpha", color: "#087cff", avatar: 1, playerName: "One" } });
    await request(`/lobby/teams/${manualFirst.teams[0].id}/join`, { method: "POST", token: manualPlayers[1].token, body: { playerName: "Two" } });
    const manualSecond = await request("/lobby/teams", { method: "POST", token: manualPlayers[2].token, body: { name: "Manual Beta", color: "#00b86b", avatar: 2, playerName: "Three" } });
    await request(`/lobby/teams/${manualSecond.teams[1].id}/join`, { method: "POST", token: manualPlayers[3].token, body: { playerName: "Four" } });
    for (const station of next.snapshot.stations) await request(`/admin/stations/${station.type}`, { method: "PATCH", token: next.token, body: { enabled: false } });
    await request("/admin/start", { method: "POST", token: next.token });
    const manualStart = await db.query("SELECT phase, quarter_number, score FROM match_score_snapshots WHERE session_id = $1", [next.snapshot.sessionId]);
    assert.equal(manualStart.rows.length, 2);
    assert.ok(manualStart.rows.every((item) => item.phase === "START" && item.quarter_number === 0 && item.score === 0));
    const energy = await db.query("SELECT id FROM resource_types WHERE code = 'ENERGY'");
    await db.query("INSERT INTO resource_stocks (session_id, team_id, resource_type_id, quantity) VALUES ($1, $2, $3, 10)", [next.snapshot.sessionId, manualFirst.teams[0].id, energy.rows[0].id]);
    const manualTender = await request("/tenders", { method: "POST", token: next.token, body: { title: "Manual close", deadlineQuarter: 2, requirements: [{ resourceCode: "ENERGY", requiredUnits: 10 }], idempotencyKey: randomUUID() } });
    await request(`/tenders/${manualTender[0].id}/contributions`, { method: "POST", token: manualPlayers[0].token, body: { resourceCode: "ENERGY", quantity: 4, idempotencyKey: randomUUID() } });
    const manualPrice = await db.query("SELECT current_unit_price FROM resource_prices WHERE session_id = $1 AND resource_type_id = $2", [next.snapshot.sessionId, energy.rows[0].id]);
    const manualFinished = await request("/admin/finish", { method: "POST", token: next.token });
    assert.equal(manualFinished.status, "FINISHED");
    assert.equal(manualFinished.resultHistory.length, 4);
    assert.equal(manualFinished.results.length, 2);
    assert.deepEqual((await request("/auth/me", { token: manualPlayers[0].token })).results, manualFinished.results);
    assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM match_score_snapshots WHERE session_id = $1 AND phase = 'FINAL'", [next.snapshot.sessionId])).rows[0].count, 2);
    const manualPayout = await db.query("SELECT amount_signed FROM ledger_entries WHERE session_id = $1 AND operation_type = 'TENDER_PAYOUT' AND idempotency_key = $2", [next.snapshot.sessionId, `${manualTender[0].id}:${manualFirst.teams[0].id}`]);
    assert.equal(manualPayout.rows.length, 1);
    assert.equal(manualPayout.rows[0].amount_signed, Math.round(4 * manualPrice.rows[0].current_unit_price * 0.75));
    const manualWinner = manualFinished.results.find((item) => item.teamId === manualFirst.teams[0].id);
    assert.equal(manualWinner.balance, manualPayout.rows[0].amount_signed);
    assert.equal(manualWinner.stockUnits, 6);
    await db.query("UPDATE teams SET electronic_balance = 0 WHERE session_id = $1", [next.snapshot.sessionId]);
    await db.query("UPDATE resource_stocks SET quantity = 0 WHERE session_id = $1", [next.snapshot.sessionId]);
    assert.deepEqual((await request("/auth/me", { token: manualPlayers[0].token })).results, manualFinished.results);
    await request("/admin/finish", { method: "POST", token: next.token });
    assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM match_score_snapshots WHERE session_id = $1", [next.snapshot.sessionId])).rows[0].count, 4);
  } finally { await db.end(); }
  console.log("OK: lobby, bank, market and cash construction, quarter production, tenders, patents, medicine, projector, Socket.IO");
} finally {
  for (const socket of sockets) socket.disconnect();
  if (organizerToken) await request("/admin/finish", { method: "POST", token: organizerToken }).catch(() => {});
  if (expiringOrganizerToken) await request("/admin/finish", { method: "POST", token: expiringOrganizerToken }).catch(() => {});
}
