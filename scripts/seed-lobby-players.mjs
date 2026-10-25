import { createDecipheriv, createHash, randomUUID } from "node:crypto";
import pg from "pg";

const expectedSessionId = process.argv[2];
if (!expectedSessionId) throw new Error("Pass the expected session ID");

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

try {
  const sessions = (await db.query("SELECT id FROM game_sessions WHERE status = 'WAITING'")).rows;
  if (sessions.length !== 1 || sessions[0].id !== expectedSessionId) {
    throw new Error("The current waiting session changed; no players were added");
  }

  const credential = (await db.query(
    "SELECT secret_cipher FROM join_credentials WHERE session_id = $1 AND purpose = 'PLAYER_JOIN' AND revoked_at IS NULL",
    [expectedSessionId],
  )).rows[0];
  if (!credential) throw new Error("Player join code is unavailable");
  const raw = Buffer.from(credential.secret_cipher, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", createHash("sha256").update(process.env.SESSION_SECRET).digest(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  const code = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");

  async function request(path, body, token) {
    const response = await fetch(`http://127.0.0.1:3001/api${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status} ${JSON.stringify(data)}`);
    return data;
  }

  async function teams() {
    return (await db.query(
      "SELECT t.id, t.name, count(p.id)::int AS players FROM teams t LEFT JOIN participants p ON p.team_id = t.id AND p.disqualified_at IS NULL WHERE t.session_id = $1 GROUP BY t.id, t.name ORDER BY t.name",
      [expectedSessionId],
    )).rows;
  }

  async function joinSession() {
    const player = await request("/lobby/join", { code, deviceId: randomUUID() });
    if (player.sessionId !== expectedSessionId) throw new Error("Player joined another session");
    return player.token;
  }

  async function fillTeam(team, prefix) {
    for (let number = team.players + 1; number <= 3; number++) {
      const token = await joinSession();
      await request(`/lobby/teams/${team.id}/join`, { playerName: `${prefix} ${number}` }, token);
    }
  }

  const current = await teams();
  if (current.length !== 1 || current[0].players !== 1) {
    throw new Error("Expected exactly one existing team with one player");
  }
  await fillTeam(current[0], current[0].name);

  for (const spec of [
    { name: "Команда Бета", color: "#8758f5", avatar: 2, prefix: "Бета" },
    { name: "Команда Гамма", color: "#00b98b", avatar: 3, prefix: "Гамма" },
  ]) {
    let team = (await teams()).find((item) => item.name === spec.name);
    if (!team) {
      const token = await joinSession();
      const state = await request("/lobby/teams", { name: spec.name, color: spec.color, avatar: spec.avatar, playerName: `${spec.prefix} 1` }, token);
      team = state.teams.find((item) => item.name === spec.name);
    }
    await fillTeam((await teams()).find((item) => item.id === team.id), spec.prefix);
  }

  const result = await teams();
  if (result.length !== 3 || result.some((team) => team.players !== 3)) throw new Error(`Unexpected team counts: ${JSON.stringify(result)}`);
  console.log(result.map(({ name, players }) => ({ name, players })));
} finally {
  await db.end();
}
