import { randomBytes, randomInt, createHash, createHmac, createCipheriv, createDecipheriv } from "node:crypto";
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit, UnauthorizedException } from "@nestjs/common";
import { ActorType, CredentialPurpose, MatchSnapshotPhase, Prisma, PrismaClient, SessionStatus, StationType } from "@prisma/client";
import type { Server, Socket } from "socket.io";
import { completedQuarters, quarterAt, sessionExpired } from "./quarter-timing.js";
import { settleQuarter } from "./quarter-production.js";
import { applyLoanPayment, loanPayoff, loanQuote } from "./loan-math.js";
import { calculateMatchResults } from "./match-results.js";

const stations = Object.values(StationType);
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const digits = "23456789";
type Actor = { role: "ORGANIZER" | "PLAYER" | "STAFF"; sessionId: string; id: string; stationType?: StationType };

@Injectable()
export class LobbyService implements OnModuleInit, OnModuleDestroy {
  private readonly db = new PrismaClient();
  private io?: Server;
  private clockTick?: ReturnType<typeof setInterval>;
  private clockSyncing = false;
  private readonly encryptionKey = createHash("sha256").update(this.requiredEnv("SESSION_SECRET")).digest();
  private readonly codePepper = this.requiredEnv("PLAYER_JOIN_CODE_PEPPER");

  private requiredEnv(name: string) {
    const value = process.env[name];
    if (!value) throw new Error(`${name} must be configured`);
    return value;
  }

  async onModuleInit() {
    await this.db.stationReadiness.updateMany({ where: { session: { status: SessionStatus.WAITING } }, data: { ready: false } });
    this.clockTick = setInterval(() => { void this.advanceDueSessions().catch((error) => console.error("Match clock sync failed", error)); }, 1000);
    void this.advanceDueSessions().catch((error) => console.error("Match clock sync failed", error));
  }
  async onModuleDestroy() { if (this.clockTick) clearInterval(this.clockTick); await this.db.$disconnect(); }
  attachSocketServer(io: Server) { this.io = io; }
  private token() { return randomBytes(32).toString("base64url"); }
  private tokenHash(value: string) { return createHash("sha256").update(value).digest("hex"); }
  private codeHash(value: string) { return createHmac("sha256", this.codePepper).update(value).digest("hex"); }
  private code(length: number) { return Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join(""); }
  private playerName(value: unknown) {
    if (typeof value !== "string") throw new BadRequestException("Введите имя игрока");
    const name = value.trim().replace(/\s+/g, " ");
    if (!name || name.length > 32 || /[\p{Cc}\p{Cf}]/u.test(name)) throw new BadRequestException("Имя игрока должно содержать от 1 до 32 символов");
    return name;
  }
  private async lockSession(tx: Prisma.TransactionClient, sessionId: string) {
    await tx.$queryRaw`SELECT id FROM game_sessions WHERE id = ${sessionId}::uuid FOR UPDATE`;
  }
  private staffCode() {
    const chars = [letters[randomInt(letters.length)], digits[randomInt(digits.length)], ...this.code(4)];
    for (let index = chars.length - 1; index > 0; index--) {
      const other = randomInt(index + 1);
      [chars[index], chars[other]] = [chars[other], chars[index]];
    }
    return chars.join("");
  }
  private encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey, iv);
    const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
  }
  private decrypt(value: string) {
    const raw = Buffer.from(value, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", this.encryptionKey, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  }

  async createSession(command: string) {
    if (command !== "create") throw new UnauthorizedException("Неверная команда");
    const organizerToken = this.token();
    const playerCode = String(randomInt(100000)).padStart(5, "0");
    const projectorCode = this.staffCode();
    const projectorToken = this.token();
    const staffCodes = stations.map((stationType) => ({ stationType, code: this.staffCode() }));
    try {
      const session = await this.db.$transaction(async (tx) => {
        const created = await tx.gameSession.create({ data: {
          name: "SKYLINE", status: SessionStatus.WAITING, quarterDurationSec: 300, totalQuarters: 10,
          organizerTokenHash: this.tokenHash(organizerToken),
        } });
        await tx.joinCredential.createMany({ data: [
          { sessionId: created.id, purpose: CredentialPurpose.PLAYER_JOIN, secretHash: this.codeHash(playerCode), secretCipher: this.encrypt(playerCode) },
          { sessionId: created.id, purpose: CredentialPurpose.PUBLIC_DISPLAY, secretHash: this.codeHash(projectorCode), secretCipher: this.encrypt(projectorCode), usesLimit: 1 },
          { sessionId: created.id, purpose: CredentialPurpose.PUBLIC_DISPLAY, secretHash: this.tokenHash(projectorToken), secretCipher: this.encrypt(projectorToken) },
          ...staffCodes.map(({ stationType, code }) => ({ sessionId: created.id, purpose: CredentialPurpose.STAFF_LOGIN, stationType, secretHash: this.codeHash(code), secretCipher: this.encrypt(code), usesLimit: 1 })),
        ] });
        await tx.projectorState.create({ data: { sessionId: created.id } });
        await tx.stationReadiness.createMany({ data: stations.map((stationType) => ({ sessionId: created.id, stationType, enabled: true, required: true })) });
        const [objects, resources] = await Promise.all([
          tx.objectType.findMany({ select: { id: true, purchaseBasePrice: true } }),
          tx.resourceType.findMany({ select: { id: true, baseUnitPrice: true } }),
        ]);
        await tx.objectPrice.createMany({ data: objects.map((item) => ({ sessionId: created.id, objectTypeId: item.id, currentPrice: item.purchaseBasePrice })) });
        await tx.resourcePrice.createMany({ data: resources.map((item) => ({ sessionId: created.id, resourceTypeId: item.id, currentUnitPrice: item.baseUnitPrice })) });
        await tx.auditEvent.create({ data: { sessionId: created.id, actorType: ActorType.ORGANIZER, action: "session.created", payload: {} } });
        return created;
      });
      return { token: organizerToken, sessionId: session.id, role: "ORGANIZER", snapshot: await this.snapshot(organizerToken) };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Сессия уже создана");
      throw error;
    }
  }

  async loginStaff(codeInput: string) {
    const code = codeInput.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) throw new UnauthorizedException("Неверный код администратора");
    const credential = await this.db.joinCredential.findFirst({
      where: { purpose: CredentialPurpose.STAFF_LOGIN, secretHash: this.codeHash(code), revokedAt: null, session: { status: { in: [SessionStatus.WAITING, SessionStatus.ACTIVE] } } },
    });
    if (!credential?.stationType) throw new UnauthorizedException("Неверный код администратора");
    const station = await this.db.stationReadiness.findUnique({ where: { sessionId_stationType: { sessionId: credential.sessionId, stationType: credential.stationType } } });
    if (!station?.enabled) throw new ForbiddenException("Структура отключена");
    const token = this.token();
    try {
      await this.db.$transaction(async (tx) => {
        await this.lockSession(tx, credential.sessionId);
        const currentStation = await tx.stationReadiness.findUnique({ where: { sessionId_stationType: { sessionId: credential.sessionId, stationType: credential.stationType! } } });
        if (!currentStation?.enabled) throw new ForbiddenException("Структура отключена");
        const used = await tx.joinCredential.updateMany({ where: { id: credential.id, secretHash: this.codeHash(code), usedCount: 0, revokedAt: null }, data: { usedCount: 1 } });
        if (!used.count) throw new ConflictException("Код уже использован. Восстановите вход на исходном устройстве");
        await tx.staffSession.upsert({
          where: { gameSessionId_stationType: { gameSessionId: credential.sessionId, stationType: credential.stationType! } },
          create: { gameSessionId: credential.sessionId, stationType: credential.stationType!, credentialId: credential.id, sessionTokenHash: this.tokenHash(token) },
          update: { credentialId: credential.id, sessionTokenHash: this.tokenHash(token), joinedAt: new Date(), revokedAt: null },
        });
        await tx.auditEvent.create({ data: { sessionId: credential.sessionId, actorType: ActorType.GAME_MASTER, action: "staff.joined", payload: { stationType: credential.stationType } } });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Структура уже занята");
      throw error;
    }
    await this.publish(credential.sessionId);
    return { token, sessionId: credential.sessionId, role: "STAFF", stationType: credential.stationType, snapshot: await this.snapshot(token) };
  }

  async joinPlayer(codeInput: string, deviceId: string) {
    const code = codeInput.trim();
    if (!/^\d{5}$/.test(code)) throw new BadRequestException("Введите пятизначный код сессии");
    if (!/^[0-9a-f-]{36}$/i.test(deviceId)) throw new BadRequestException("Не удалось определить устройство");
    const credential = await this.db.joinCredential.findFirst({ where: {
      purpose: CredentialPurpose.PLAYER_JOIN, secretHash: this.codeHash(code), revokedAt: null,
      session: { status: { in: [SessionStatus.WAITING, SessionStatus.ACTIVE] } },
    } });
    if (!credential) throw new NotFoundException("Сессия не найдена или уже началась");
    const deviceIdHash = this.codeHash(`${credential.sessionId}:${deviceId}`);
    const existing = await this.db.participant.findUnique({ where: { deviceIdHash } });
    if (existing?.disqualifiedAt) throw new ForbiddenException("Участник дисквалифицирован");
    if (existing) throw new ConflictException("Это устройство уже участвует. Восстановите сохранённый вход");
    const token = this.token();
    let participant;
    try {
      participant = await this.db.participant.create({ data: { sessionId: credential.sessionId, sessionTokenHash: this.tokenHash(token), deviceIdHash } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Это устройство уже участвует");
      throw error;
    }
    await this.publish(credential.sessionId);
    return { token, sessionId: credential.sessionId, participantId: participant.id, role: "PLAYER", snapshot: await this.snapshot(token) };
  }

  async actor(token: string): Promise<Actor> {
    if (!token || token.length < 32) throw new UnauthorizedException("Токен отсутствует");
    const hash = this.tokenHash(token);
    const [organizer, player, staff] = await Promise.all([
      this.db.gameSession.findUnique({ where: { organizerTokenHash: hash } }),
      this.db.participant.findUnique({ where: { sessionTokenHash: hash } }),
      this.db.staffSession.findUnique({ where: { sessionTokenHash: hash } }),
    ]);
    if (organizer) return { role: "ORGANIZER", sessionId: organizer.id, id: organizer.id };
    if (player) return { role: "PLAYER", sessionId: player.sessionId, id: player.id };
    if (staff && !staff.revokedAt) return { role: "STAFF", sessionId: staff.gameSessionId, id: staff.id, stationType: staff.stationType };
    throw new UnauthorizedException("Сессия устройства не найдена");
  }

  private async requireRole(token: string, role: Actor["role"]) {
    const actor = await this.actor(token);
    if (actor.role !== role) throw new ForbiddenException("Недостаточно прав");
    return actor;
  }

  private async recordScoreSnapshot(tx: Prisma.TransactionClient, sessionId: string, quarter: number, phase: MatchSnapshotPhase) {
    const existing = await tx.matchScoreSnapshot.count({ where: { sessionId, phase, quarterNumber: quarter } });
    if (existing) return;
    const [teams, buildings, stocks, loans] = await Promise.all([
      tx.team.findMany({ where: { sessionId }, select: { id: true, name: true, electronicBalance: true } }),
      tx.ownedObject.findMany({ where: { sessionId }, select: { teamId: true, quantity: true, objectType: { select: { purchaseBasePrice: true } } } }),
      tx.resourceStock.findMany({ where: { sessionId }, select: { teamId: true, quantity: true, resourceType: { select: { baseUnitPrice: true } } } }),
      tx.loan.findMany({ where: { sessionId, remaining: { gt: 0 } } }),
    ]);
    const results = calculateMatchResults(
      teams.map((team) => ({ id: team.id, name: team.name, balance: team.electronicBalance, assetsCount: buildings.filter((item) => item.teamId === team.id).reduce((sum, item) => sum + item.quantity, 0) })),
      buildings.map((item) => ({ teamId: item.teamId, quantity: item.quantity, basePrice: item.objectType.purchaseBasePrice })),
      stocks.map((item) => ({ teamId: item.teamId, quantity: item.quantity, basePrice: item.resourceType.baseUnitPrice })),
      loans.map((item) => ({ teamId: item.teamId, amount: loanPayoff(item, quarter).due })),
    );
    if (!results.length) return;
    await tx.matchScoreSnapshot.createMany({ data: results.map((item) => ({
      sessionId, teamId: item.teamId, phase, quarterNumber: quarter, teamName: item.name,
      balance: item.balance, assetsCount: item.assetsCount, stockUnits: item.stockUnits,
      buildingPoints: item.buildingPoints, resourcePoints: item.resourcePoints,
      debt: item.debt, debtDeduction: item.debtDeduction, score: item.score, rank: item.rank, isWinner: item.isWinner,
    })) });
  }

  async snapshot(token: string) {
    const actor = await this.actor(token);
    if (actor.role === "ORGANIZER") await this.ensureProjectorAccess(actor.sessionId);
    const session = await this.db.gameSession.findUnique({ where: { id: actor.sessionId }, include: {
      teams: { orderBy: { createdAt: "asc" }, include: { participants: { orderBy: { joinedAt: "asc" } }, ownedObjects: { select: { quantity: true, objectType: { select: { code: true } } } } } },
      participants: { orderBy: { joinedAt: "asc" } }, stationReadiness: { orderBy: { stationType: "asc" } },
      staffSessions: { where: { revokedAt: null } },
      credentials: actor.role === "ORGANIZER" ? true : false,
    } });
    if (!session) throw new NotFoundException("Сессия не найдена");
    if (actor.role === "STAFF" && session.status !== SessionStatus.FINISHED && !session.stationReadiness.find((item) => item.stationType === actor.stationType)?.enabled) throw new ForbiddenException("Структура отключена");
    const teams = session.teams.map((team) => ({
      id: team.id, name: team.name, code: team.code, color: team.color, avatar: team.avatar,
      balance: team.electronicBalance, assetsCount: team.ownedObjects.reduce((sum, asset) => sum + asset.quantity, 0),
      buildings: Object.fromEntries([...new Set(team.ownedObjects.map((asset) => asset.objectType.code))].map((code) => [code, team.ownedObjects.filter((asset) => asset.objectType.code === code).reduce((sum, asset) => sum + asset.quantity, 0)])),
      members: team.participants.filter((person) => !person.disqualifiedAt).length,
      participants: team.participants.filter((person) => !person.disqualifiedAt).map((person) => ({ id: person.id, teamId: team.id, displayName: person.displayName || `Игрок ${person.id.slice(0, 4)}`, disqualified: false })),
    }));
    const player = actor.role === "PLAYER" ? session.participants.find((person) => person.id === actor.id) : undefined;
    const assets = player?.teamId ? await this.db.ownedObject.findMany({
      where: { sessionId: session.id, teamId: player.teamId }, orderBy: { createdAt: "asc" },
      include: { objectType: { include: { yields: { include: { resourceType: true } } } } },
    }) : [];
    const stocks = player?.teamId ? await this.db.resourceStock.findMany({
      where: { sessionId: session.id, teamId: player.teamId }, include: { resourceType: true },
    }) : [];
    const playerLoan = player?.teamId ? await this.db.loan.findFirst({ where: { sessionId: session.id, teamId: player.teamId, remaining: { gt: 0 } }, orderBy: { createdAt: "desc" } }) : null;
    const transactionTeamId = actor.role === "PLAYER" ? player?.teamId : null;
    const showTransactions = actor.role === "STAFF" && (actor.stationType === StationType.ATM || actor.stationType === StationType.BANK) || !!transactionTeamId;
    const transactions = showTransactions
      ? await this.db.ledgerEntry.findMany({ where: { sessionId: session.id, ...(transactionTeamId ? { teamId: transactionTeamId } : {}), operationType: { in: ["ATM_DEPOSIT", "ATM_WITHDRAW"] } }, orderBy: { createdAt: "desc" }, take: 3 })
      : [];
    const savedScores = session.status === SessionStatus.FINISHED
      ? await this.db.matchScoreSnapshot.findMany({ where: { sessionId: session.id }, orderBy: [{ quarterNumber: "asc" }, { phase: "asc" }, { rank: "asc" }, { teamName: "asc" }] }) : [];
    const scoreView = (item: typeof savedScores[number]) => ({
      teamId: item.teamId, name: item.teamName, balance: item.balance, assetsCount: item.assetsCount,
      stockUnits: item.stockUnits, buildingPoints: item.buildingPoints, resourcePoints: item.resourcePoints,
      debt: item.debt, debtDeduction: item.debtDeduction, score: item.score, rank: item.rank, isWinner: item.isWinner,
    });
    const results = session.status === SessionStatus.FINISHED ? savedScores.filter((item) => item.phase === MatchSnapshotPhase.FINAL).map(scoreView) : null;
    const resultHistory = session.status === SessionStatus.FINISHED ? savedScores.map((item) => ({ phase: item.phase, quarter: item.quarterNumber, recordedAt: item.recordedAt.toISOString(), ...scoreView(item) })) : null;
    return {
      sessionId: session.id, status: session.status, currentQuarter: session.currentQuarter,
      quarterDurationSec: session.quarterDurationSec, totalQuarters: session.totalQuarters, startsAt: session.startsAt?.toISOString() ?? null,
      serverTime: Date.now(), sequence: session.eventSequence, role: actor.role, results, resultHistory,
      stationType: actor.stationType ?? null, participantId: player?.id ?? null, teamId: player?.teamId ?? null,
      disqualified: !!player?.disqualifiedAt, teams,
      assets: assets.map((asset) => ({ id: asset.id, code: asset.objectType.code, category: asset.objectType.category, quantity: asset.quantity, builtInQuarter: asset.builtInQuarter, firstProductionQuarter: asset.firstProductionQuarter, yields: asset.objectType.yields.map((item) => ({ code: item.resourceType.code, label: item.resourceType.label, unitsPerQuarter: item.unitsPerQuarter })) })),
      resources: stocks.map((stock) => ({ code: stock.resourceType.code, label: stock.resourceType.label, quantity: stock.quantity })),
      loan: playerLoan ? { id: playerLoan.id, principal: playerLoan.principal, total: playerLoan.totalDue, remaining: loanPayoff(playerLoan, session.currentQuarter).due, accruedInterest: loanPayoff(playerLoan, session.currentQuarter).interest, paymentPerQuarter: loanQuote(playerLoan.principal, playerLoan.rateBasisPoints, playerLoan.quarters).paymentPerQuarter } : null,
      transactions: transactions.map((item) => ({ id: item.id, teamId: item.teamId, type: item.operationType === "ATM_DEPOSIT" ? "deposit" : "withdraw", amount: Math.abs(item.amountSigned), createdAt: item.createdAt.toISOString() })),
      stations: session.stationReadiness.map((item) => ({ type: item.stationType, enabled: item.enabled, ready: item.ready, assigned: session.staffSessions.some((staff) => staff.stationType === item.stationType) })),
      participants: actor.role === "ORGANIZER" ? session.participants.map((person) => ({ id: person.id, teamId: person.teamId, displayName: person.displayName || `Игрок ${person.id.slice(0, 4)}`, disqualified: !!person.disqualifiedAt })) : undefined,
      codes: actor.role === "ORGANIZER" ? {
        player: session.credentials.find((item) => item.purpose === CredentialPurpose.PLAYER_JOIN)?.secretCipher && this.decrypt(session.credentials.find((item) => item.purpose === CredentialPurpose.PLAYER_JOIN)!.secretCipher),
        projector: this.decrypt(session.credentials.find((item) => item.purpose === CredentialPurpose.PUBLIC_DISPLAY && item.usesLimit === 1)!.secretCipher),
        staff: Object.fromEntries(session.credentials.filter((item) => item.purpose === CredentialPurpose.STAFF_LOGIN && item.stationType).map((item) => [item.stationType!, this.decrypt(item.secretCipher)])),
      } : undefined,
    };
  }

  async createTeam(token: string, input: { name: string; color: string; avatar: number; playerName: string }) {
    const actor = await this.requireRole(token, "PLAYER");
    const name = input.name?.trim();
    const playerName = this.playerName(input.playerName);
    if (!name || name.length > 25 || !/^#[0-9a-fA-F]{6}$/.test(input.color) || !Number.isInteger(input.avatar) || input.avatar < 0 || input.avatar > 19) throw new BadRequestException("Проверьте название, цвет и аватар");
    try {
      await this.db.$transaction(async (tx) => {
        const claimed = await tx.participant.updateMany({ where: { id: actor.id, teamId: null, disqualifiedAt: null, session: { status: SessionStatus.WAITING } }, data: { lastSeenAt: new Date() } });
        if (!claimed.count) throw new ConflictException("Команда уже выбрана или вход закрыт");
        const team = await tx.team.create({ data: { sessionId: actor.sessionId, name, color: input.color, avatar: input.avatar, code: this.code(4) } });
        await tx.participant.update({ where: { id: actor.id }, data: { teamId: team.id, displayName: playerName } });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Название команды уже занято");
      throw error;
    }
    await this.publish(actor.sessionId);
    return this.snapshot(token);
  }

  async joinTeam(token: string, teamId: string, playerNameInput: unknown) {
    const actor = await this.requireRole(token, "PLAYER");
    const playerName = this.playerName(playerNameInput);
    const team = await this.db.team.findFirst({ where: { id: teamId, sessionId: actor.sessionId } });
    if (!team) throw new NotFoundException("Команда не найдена");
    const claimed = await this.db.participant.updateMany({ where: { id: actor.id, teamId: null, disqualifiedAt: null, session: { status: { in: [SessionStatus.WAITING, SessionStatus.ACTIVE] } } }, data: { teamId, displayName: playerName } });
    if (!claimed.count) throw new ConflictException("Команда уже выбрана или вход закрыт");
    await this.publish(actor.sessionId);
    return this.snapshot(token);
  }

  async leaveTeam(token: string) {
    const actor = await this.requireRole(token, "PLAYER");
    await this.db.participant.updateMany({ where: { id: actor.id, session: { status: SessionStatus.WAITING }, disqualifiedAt: null }, data: { teamId: null } });
    await this.publish(actor.sessionId);
    return this.snapshot(token);
  }

  async setStation(token: string, stationType: StationType, enabled: boolean) {
    const actor = await this.requireRole(token, "ORGANIZER");
    if (!stations.includes(stationType) || typeof enabled !== "boolean") throw new BadRequestException("Неверная структура");
    await this.db.$transaction(async (tx) => {
      await this.lockSession(tx, actor.sessionId);
      const session = await tx.gameSession.findUniqueOrThrow({ where: { id: actor.sessionId } });
      if (session.status !== SessionStatus.WAITING) throw new ConflictException("Настройки заблокированы после старта");
      if (!enabled) {
        const staff = await tx.staffSession.findFirst({ where: { gameSessionId: actor.sessionId, stationType, revokedAt: null } });
        if (staff) throw new ConflictException("Сначала исключите администратора структуры");
      }
      await tx.stationReadiness.update({ where: { sessionId_stationType: { sessionId: actor.sessionId, stationType } }, data: { enabled, required: enabled, ready: false } });
      await tx.auditEvent.create({ data: { sessionId: actor.sessionId, actorType: ActorType.ORGANIZER, action: "station.updated", payload: { stationType, enabled } } });
    });
    await this.publish(actor.sessionId);
    return this.snapshot(token);
  }

  async kickStaff(token: string, stationType: StationType) {
    const actor = await this.requireRole(token, "ORGANIZER");
    if (!stations.includes(stationType)) throw new BadRequestException("Неверная структура");
    const newCode = this.staffCode();
    const staff = await this.db.$transaction(async (tx) => {
      await this.lockSession(tx, actor.sessionId);
      const current = await tx.staffSession.findUnique({ where: { gameSessionId_stationType: { gameSessionId: actor.sessionId, stationType } } });
      if (!current || current.revokedAt) throw new ConflictException("Администратор структуры не подключён");
      await tx.staffSession.update({ where: { id: current.id }, data: { revokedAt: new Date() } });
      await tx.joinCredential.update({ where: { id: current.credentialId }, data: { secretHash: this.codeHash(newCode), secretCipher: this.encrypt(newCode), usedCount: 0 } });
      await tx.stationReadiness.update({ where: { sessionId_stationType: { sessionId: actor.sessionId, stationType } }, data: { ready: false } });
      await tx.auditEvent.create({ data: { sessionId: actor.sessionId, actorType: ActorType.ORGANIZER, action: "staff.kicked", payload: { stationType } } });
      return current;
    });
    for (const socket of this.io?.sockets.sockets.values() ?? []) {
      if (socket.data.actor?.id !== staff.id) continue;
      socket.emit("access:revoked");
      socket.disconnect(true);
    }
    await this.publish(actor.sessionId);
    return this.snapshot(token);
  }

  async movePlayer(token: string, participantId: string, teamId: string) {
    const actor = await this.requireRole(token, "ORGANIZER");
    const team = await this.db.team.findFirst({ where: { id: teamId, sessionId: actor.sessionId } });
    if (!team) throw new NotFoundException("Команда не найдена");
    const updated = await this.db.participant.updateMany({ where: { id: participantId, sessionId: actor.sessionId, disqualifiedAt: null }, data: { teamId } });
    if (!updated.count) throw new NotFoundException("Игрок не найден");
    await this.db.auditEvent.create({ data: { sessionId: actor.sessionId, actorType: ActorType.ORGANIZER, action: "player.moved", payload: { participantId, teamId } } });
    await this.publish(actor.sessionId);
    return this.snapshot(token);
  }

  async disqualifyPlayer(token: string, participantId: string) {
    const actor = await this.requireRole(token, "ORGANIZER");
    const updated = await this.db.participant.updateMany({ where: { id: participantId, sessionId: actor.sessionId, disqualifiedAt: null }, data: { disqualifiedAt: new Date(), teamId: null } });
    if (!updated.count) throw new NotFoundException("Игрок не найден");
    await this.db.auditEvent.create({ data: { sessionId: actor.sessionId, actorType: ActorType.ORGANIZER, action: "player.disqualified", payload: { participantId } } });
    await this.publish(actor.sessionId);
    return this.snapshot(token);
  }

  async updateSettings(token: string, input: { totalQuarters?: unknown; quarterDurationMin?: unknown }) {
    const actor = await this.requireRole(token, "ORGANIZER");
    const totalQuarters = input?.totalQuarters;
    const quarterDurationMin = input?.quarterDurationMin;
    if (!Number.isInteger(totalQuarters) || (totalQuarters as number) < 10 || (totalQuarters as number) > 30 ||
        !Number.isInteger(quarterDurationMin) || (quarterDurationMin as number) < 5 || (quarterDurationMin as number) > 10) {
      throw new BadRequestException("Укажите 10–30 кварталов и 5–10 минут на квартал");
    }
    await this.db.$transaction(async (tx) => {
      await this.lockSession(tx, actor.sessionId);
      const session = await tx.gameSession.findUniqueOrThrow({ where: { id: actor.sessionId } });
      if (session.status !== SessionStatus.WAITING) throw new ConflictException("Время матча можно изменить только до старта");
      await tx.gameSession.update({ where: { id: actor.sessionId }, data: { totalQuarters: totalQuarters as number, quarterDurationSec: (quarterDurationMin as number) * 60 } });
      await tx.auditEvent.create({ data: { sessionId: actor.sessionId, actorType: ActorType.ORGANIZER, action: "session.settings.updated", payload: { totalQuarters: totalQuarters as number, quarterDurationMin: quarterDurationMin as number } } });
    });
    await this.publish(actor.sessionId);
    return this.snapshot(token);
  }

  async atmTransaction(token: string, input: { teamId?: unknown; amount?: unknown; type?: unknown; idempotencyKey?: unknown }) {
    const actor = await this.requireRole(token, "STAFF");
    if (actor.stationType !== StationType.ATM && actor.stationType !== StationType.BANK) throw new ForbiddenException("Недостаточно прав для банкомата");
    const { teamId, amount, type, idempotencyKey } = input ?? {};
    if (typeof teamId !== "string" || !/^[0-9a-f-]{36}$/i.test(teamId) ||
        !Number.isInteger(amount) || (amount as number) <= 0 || (amount as number) > 1_000_000_000 || (amount as number) % 500 !== 0 ||
        (type !== "deposit" && type !== "withdraw") || typeof idempotencyKey !== "string" || !/^[0-9a-f-]{36}$/i.test(idempotencyKey)) {
      throw new BadRequestException("Проверьте команду и сумму: она должна быть положительной и кратной 500 ₽");
    }
    const operationType = type === "deposit" ? "ATM_DEPOSIT" : "ATM_WITHDRAW";
    const changed = await this.db.$transaction(async (tx) => {
      await this.lockSession(tx, actor.sessionId);
      const session = await tx.gameSession.findUniqueOrThrow({ where: { id: actor.sessionId } });
      const staff = await tx.staffSession.findUniqueOrThrow({ where: { id: actor.id } });
      if (session.status !== SessionStatus.ACTIVE || staff.revokedAt) throw new ConflictException("Операции недоступны вне активного матча");
      const previous = await tx.ledgerEntry.findUnique({ where: { sessionId_operationType_idempotencyKey: { sessionId: actor.sessionId, operationType, idempotencyKey } } });
      if (previous) {
        if (previous.teamId !== teamId || Math.abs(previous.amountSigned) !== amount) throw new ConflictException("Ключ операции уже использован");
        return false;
      }
      const team = await tx.team.findFirst({ where: { id: teamId, sessionId: actor.sessionId } });
      if (!team) throw new NotFoundException("Команда не найдена");
      const signed = type === "deposit" ? amount as number : -(amount as number);
      const balanceAfter = team.electronicBalance + signed;
      if (balanceAfter < 0) throw new ConflictException("Недостаточно средств на балансе команды");
      if (balanceAfter > 2_147_483_647) throw new ConflictException("Превышен лимит баланса");
      await tx.team.update({ where: { id: teamId }, data: { electronicBalance: balanceAfter } });
      await tx.ledgerEntry.create({ data: { sessionId: actor.sessionId, teamId, operationType, amountSigned: signed, balanceAfter, idempotencyKey, actorId: actor.id } });
      await tx.auditEvent.create({ data: { sessionId: actor.sessionId, actorType: ActorType.GAME_MASTER, action: "atm.transaction", payload: { teamId, operationType, amount: amount as number, balanceAfter } } });
      return true;
    });
    if (changed) await this.publish(actor.sessionId);
    return this.snapshot(token);
  }

  async start(token: string) {
    const actor = await this.requireRole(token, "ORGANIZER");
    await this.db.$transaction(async (tx) => {
      const current = await tx.gameSession.findUniqueOrThrow({ where: { id: actor.sessionId }, include: { stationReadiness: true } });
      if (current.status !== SessionStatus.WAITING) throw new ConflictException("Матч уже начался");
      const missing = current.stationReadiness.filter((item) => item.enabled && !item.ready);
      if (missing.length) throw new ConflictException(`Не подключены структуры: ${missing.map((item) => item.stationType).join(", ")}`);
      const teams = await tx.team.findMany({ where: { sessionId: actor.sessionId }, select: { participants: { where: { disqualifiedAt: null }, select: { id: true } } } });
      if (teams.filter((team) => team.participants.length >= 2).length < 2) throw new ConflictException("Для старта нужны минимум 2 команды по 2 игрока");
      const updated = await tx.gameSession.updateMany({ where: { id: actor.sessionId, status: SessionStatus.WAITING }, data: { status: SessionStatus.ACTIVE, startsAt: new Date(), currentQuarter: 1 } });
      if (!updated.count) throw new ConflictException("Матч уже начался");
      await tx.quarterRun.create({ data: { sessionId: actor.sessionId, quarterNumber: 1, status: "STARTED", ruleVersion: current.configVersion } });
      await this.recordScoreSnapshot(tx, actor.sessionId, 0, MatchSnapshotPhase.START);
      await tx.auditEvent.create({ data: { sessionId: actor.sessionId, actorType: ActorType.ORGANIZER, action: "session.started", payload: { quarter: 1 } } });
    });
    await this.publish(actor.sessionId, true);
    return this.snapshot(token);
  }

  async constructionCatalog(token: string) {
    const actor = await this.actor(token);
    if (actor.role !== "STAFF" || actor.stationType !== StationType.CONSTRUCTION) throw new ForbiddenException("Доступно только строительству");
    const station = await this.db.stationReadiness.findUnique({ where: { sessionId_stationType: { sessionId: actor.sessionId, stationType: StationType.CONSTRUCTION } } });
    if (!station?.enabled) throw new ForbiddenException("Строительство отключено");
    return this.objectCatalog(actor.sessionId);
  }

  async marketCatalog(token: string) {
    const actor = await this.requireRole(token, "PLAYER");
    const player = await this.db.participant.findUniqueOrThrow({ where: { id: actor.id } });
    if (!player.teamId || player.disqualifiedAt) throw new ForbiddenException("Нужна действующая команда");
    return this.objectCatalog(actor.sessionId);
  }

  async marketResources(token: string) {
    const actor = await this.requireRole(token, "PLAYER");
    const player = await this.db.participant.findUniqueOrThrow({ where: { id: actor.id } });
    if (!player.teamId || player.disqualifiedAt) throw new ForbiddenException("Нужна действующая команда");
    const [resources, prices, stocks] = await Promise.all([
      this.db.resourceType.findMany({ orderBy: { code: "asc" } }),
      this.db.resourcePrice.findMany({ where: { sessionId: actor.sessionId } }),
      this.db.resourceStock.findMany({ where: { sessionId: actor.sessionId, teamId: player.teamId } }),
    ]);
    return resources.map((resource) => ({
      code: resource.code,
      label: resource.label,
      quantity: stocks.find((stock) => stock.resourceTypeId === resource.id)?.quantity ?? 0,
      currentUnitPrice: prices.find((price) => price.resourceTypeId === resource.id)?.currentUnitPrice ?? resource.baseUnitPrice,
    }));
  }

  async sellResources(token: string, input: { resourceCode?: unknown; quantity?: unknown; expectedUnitPrice?: unknown; idempotencyKey?: unknown }) {
    const actor = await this.requireRole(token, "PLAYER");
    const { resourceCode, quantity, expectedUnitPrice, idempotencyKey } = input ?? {};
    if (typeof resourceCode !== "string" || !resourceCode || !Number.isInteger(quantity) || (quantity as number) < 1 || (quantity as number) > 1_000_000 || !Number.isInteger(expectedUnitPrice) || (expectedUnitPrice as number) <= 0 || typeof idempotencyKey !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(idempotencyKey)) throw new BadRequestException("Проверьте ресурс, количество и цену");
    let changed = false;
    await this.db.$transaction(async (tx) => {
      await this.lockSession(tx, actor.sessionId);
      const participant = await tx.participant.findUniqueOrThrow({ where: { id: actor.id } });
      if (!participant.teamId || participant.disqualifiedAt) throw new ForbiddenException("Нужна действующая команда");
      const resource = await tx.resourceType.findUnique({ where: { code: resourceCode } });
      if (!resource) throw new NotFoundException("Ресурс не найден");
      const previous = await tx.resourceSale.findUnique({ where: { sessionId_idempotencyKey: { sessionId: actor.sessionId, idempotencyKey } } });
      if (previous) {
        if (previous.teamId !== participant.teamId || previous.resourceTypeId !== resource.id || previous.quantity !== quantity || previous.unitPrice !== expectedUnitPrice) throw new ConflictException("Ключ операции уже использован");
        return;
      }
      const session = await tx.gameSession.findUniqueOrThrow({ where: { id: actor.sessionId } });
      if (session.status !== SessionStatus.ACTIVE || !session.startsAt || !quarterAt(session.startsAt, session.quarterDurationSec, session.totalQuarters, new Date())) throw new ConflictException("Продажа доступна только во время матча");
      const [team, stock, price] = await Promise.all([
        tx.team.findFirst({ where: { id: participant.teamId, sessionId: actor.sessionId } }),
        tx.resourceStock.findUnique({ where: { sessionId_teamId_resourceTypeId: { sessionId: actor.sessionId, teamId: participant.teamId, resourceTypeId: resource.id } } }),
        tx.resourcePrice.findUnique({ where: { sessionId_resourceTypeId: { sessionId: actor.sessionId, resourceTypeId: resource.id } } }),
      ]);
      if (!team || !stock || stock.quantity < (quantity as number)) throw new ConflictException("Недостаточно ресурсов на складе");
      const unitPrice = price?.currentUnitPrice ?? resource.baseUnitPrice;
      if (unitPrice <= 0) throw new ConflictException("Для ресурса не установлена цена");
      if (unitPrice !== expectedUnitPrice) throw new ConflictException("Цена изменилась. Проверьте её и повторите продажу");
      const totalPrice = unitPrice * (quantity as number);
      const balanceAfter = team.electronicBalance + totalPrice;
      if (!Number.isSafeInteger(totalPrice) || totalPrice > 2_147_483_647 || !Number.isSafeInteger(balanceAfter) || balanceAfter > 2_147_483_647) throw new ConflictException("Превышен лимит баланса");
      await tx.resourceStock.update({ where: { sessionId_teamId_resourceTypeId: { sessionId: actor.sessionId, teamId: team.id, resourceTypeId: resource.id } }, data: { quantity: { decrement: quantity as number } } });
      await tx.team.update({ where: { id: team.id }, data: { electronicBalance: balanceAfter } });
      await tx.resourceSale.create({ data: { sessionId: actor.sessionId, teamId: team.id, resourceTypeId: resource.id, quantity: quantity as number, unitPrice, totalPrice, idempotencyKey, actorId: actor.id } });
      await tx.ledgerEntry.create({ data: { sessionId: actor.sessionId, teamId: team.id, operationType: "RESOURCE_SALE", amountSigned: totalPrice, balanceAfter, idempotencyKey, actorId: actor.id } });
      await tx.auditEvent.create({ data: { sessionId: actor.sessionId, actorType: ActorType.PLAYER, actorId: actor.id, action: "resource.sold", payload: { teamId: team.id, resourceCode, quantity: quantity as number, unitPrice, totalPrice } } });
      changed = true;
    });
    if (changed) await this.publish(actor.sessionId);
    return this.snapshot(token);
  }

  private async objectCatalog(sessionId: string) {
    const [types, counts, objectPrices, resourcePrices] = await Promise.all([
      this.db.objectType.findMany({ where: { active: true }, include: { yields: { include: { resourceType: true } } }, orderBy: { code: "asc" } }),
      this.db.ownedObject.groupBy({ by: ["objectTypeId"], where: { sessionId }, _sum: { quantity: true } }),
      this.db.objectPrice.findMany({ where: { sessionId } }),
      this.db.resourcePrice.findMany({ where: { sessionId } }),
    ]);
    return types.map((type) => ({
      id: type.id, code: type.code, category: type.category,
      currentPrice: objectPrices.find((item) => item.objectTypeId === type.id)?.currentPrice ?? type.purchaseBasePrice + (counts.find((count) => count.objectTypeId === type.id)?._sum.quantity ?? 0) * this.objectPriceStep(type.productionRules),
      builtCount: counts.find((count) => count.objectTypeId === type.id)?._sum.quantity ?? 0,
      yields: type.yields.map((item) => ({ code: item.resourceType.code, label: item.resourceType.label, unitsPerQuarter: item.unitsPerQuarter, currentUnitPrice: resourcePrices.find((price) => price.resourceTypeId === item.resourceTypeId)?.currentUnitPrice ?? item.resourceType.baseUnitPrice })),
    }));
  }

  private objectPriceStep(rules: Prisma.JsonValue) {
    return typeof rules === "object" && rules !== null && !Array.isArray(rules) && typeof rules.priceStep === "number" ? rules.priceStep : 0;
  }

  async marketPurchase(token: string, input: { objectTypeId?: unknown; quantity?: unknown; idempotencyKey?: unknown }) {
    const actor = await this.requireRole(token, "PLAYER");
    const { objectTypeId, quantity, idempotencyKey } = input ?? {};
    if (typeof objectTypeId !== "string" || !Number.isInteger(quantity) || (quantity as number) < 1 || (quantity as number) > 20 || typeof idempotencyKey !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(idempotencyKey)) throw new BadRequestException("Проверьте объект и количество");
    let changed = false;
    await this.db.$transaction(async (tx) => {
      await this.lockSession(tx, actor.sessionId);
      const previous = await tx.ownedObject.findUnique({ where: { sessionId_idempotencyKey: { sessionId: actor.sessionId, idempotencyKey } } });
      if (previous) {
        if (previous.objectTypeId !== objectTypeId || previous.quantity !== quantity) throw new ConflictException("Ключ операции уже использован");
        const participant = await tx.participant.findUniqueOrThrow({ where: { id: actor.id } });
        if (previous.teamId !== participant.teamId) throw new ConflictException("Ключ операции принадлежит другой команде");
        const payment = await tx.ledgerEntry.findUnique({ where: { sessionId_operationType_idempotencyKey: { sessionId: actor.sessionId, operationType: "MARKET_OBJECT_PURCHASE", idempotencyKey } } });
        if (!payment) throw new ConflictException("Ключ операции уже использован строительством");
        return;
      }
      const session = await tx.gameSession.findUniqueOrThrow({ where: { id: actor.sessionId } });
      if (session.status !== SessionStatus.ACTIVE || !session.startsAt) throw new ConflictException("Рынок доступен только в активном матче");
      const timing = quarterAt(session.startsAt, session.quarterDurationSec, session.totalQuarters, new Date());
      if (!timing) throw new ConflictException("Матч завершён");
      const participant = await tx.participant.findUniqueOrThrow({ where: { id: actor.id } });
      if (!participant.teamId || participant.disqualifiedAt) throw new ForbiddenException("Нужна действующая команда");
      const [team, objectType, count, price] = await Promise.all([
        tx.team.findFirst({ where: { id: participant.teamId, sessionId: actor.sessionId } }),
        tx.objectType.findFirst({ where: { id: objectTypeId, active: true } }),
        tx.ownedObject.aggregate({ where: { sessionId: actor.sessionId, objectTypeId }, _sum: { quantity: true } }),
        tx.objectPrice.findUnique({ where: { sessionId_objectTypeId: { sessionId: actor.sessionId, objectTypeId } } }),
      ]);
      if (!team || !objectType) throw new NotFoundException("Команда или объект не найдены");
      const priceStep = this.objectPriceStep(objectType.productionRules);
      const unitPrice = price?.currentPrice ?? objectType.purchaseBasePrice + (count._sum.quantity ?? 0) * priceStep;
      const totalPrice = unitPrice * (quantity as number);
      const nextPrice = unitPrice + (quantity as number) * priceStep;
      if (!Number.isSafeInteger(totalPrice) || totalPrice <= 0 || totalPrice > 2_147_483_647 || !Number.isSafeInteger(nextPrice) || nextPrice <= 0 || nextPrice > 2_147_483_647) throw new ConflictException("Цена объекта недоступна");
      if (team.electronicBalance < totalPrice) throw new ConflictException("Недостаточно средств на балансе");
      const balanceAfter = team.electronicBalance - totalPrice;
      await tx.team.update({ where: { id: team.id }, data: { electronicBalance: balanceAfter } });
      await tx.ownedObject.create({ data: { sessionId: actor.sessionId, teamId: team.id, objectTypeId, quantity: quantity as number, unitPrice, totalPrice, builtInQuarter: timing.quarter, firstProductionQuarter: timing.firstProductionQuarter, idempotencyKey } });
      await tx.objectPrice.upsert({ where: { sessionId_objectTypeId: { sessionId: actor.sessionId, objectTypeId } }, create: { sessionId: actor.sessionId, objectTypeId, currentPrice: nextPrice }, update: { currentPrice: nextPrice } });
      await tx.ledgerEntry.create({ data: { sessionId: actor.sessionId, teamId: team.id, operationType: "MARKET_OBJECT_PURCHASE", amountSigned: -totalPrice, balanceAfter, idempotencyKey, actorId: actor.id } });
      await tx.auditEvent.create({ data: { sessionId: actor.sessionId, actorType: ActorType.PLAYER, actorId: actor.id, action: "market.object.purchased", payload: { teamId: team.id, objectTypeId, quantity: quantity as number, unitPrice, totalPrice, quarter: timing.quarter } } });
      changed = true;
    });
    if (changed) await this.publish(actor.sessionId);
    return this.snapshot(token);
  }

  private async requireTenderEditor(token: string) {
    const actor = await this.actor(token);
    if (actor.role === "ORGANIZER") return actor;
    if (actor.role !== "STAFF" || actor.stationType !== StationType.ENTERPRISES) throw new ForbiddenException("Тендеры создаёт организатор или игротех предприятий");
    const station = await this.db.stationReadiness.findUnique({ where: { sessionId_stationType: { sessionId: actor.sessionId, stationType: StationType.ENTERPRISES } } });
    if (!station?.enabled) throw new ForbiddenException("Предприятия отключены");
    return actor;
  }

  private async settleTender(tx: Prisma.TransactionClient, tenderId: string, percentage: 125 | 75) {
    const tender = await tx.tender.findUniqueOrThrow({ where: { id: tenderId }, include: { contributions: true } });
    if (tender.paidAt) return;
    const prices = await tx.resourcePrice.findMany({ where: { sessionId: tender.sessionId } });
    const resourceTypes = await tx.resourceType.findMany({ select: { id: true, baseUnitPrice: true } });
    const values = new Map<string, number>();
    for (const entry of tender.contributions) {
      const unitPrice = prices.find((item) => item.resourceTypeId === entry.resourceTypeId)?.currentUnitPrice
        ?? resourceTypes.find((item) => item.id === entry.resourceTypeId)?.baseUnitPrice ?? 0;
      values.set(entry.teamId, (values.get(entry.teamId) ?? 0) + entry.quantity * unitPrice);
    }
    const payouts: { teamId: string; amount: number }[] = [];
    for (const [teamId, value] of values) {
      const amount = Math.round(value * percentage / 100);
      if (!Number.isSafeInteger(amount) || amount < 0) throw new ConflictException("Сумма выплаты по тендеру недоступна");
      if (!amount) continue;
      const team = await tx.team.findUniqueOrThrow({ where: { id: teamId } });
      const balanceAfter = team.electronicBalance + amount;
      if (balanceAfter > 2_147_483_647) throw new ConflictException("Превышен лимит баланса команды");
      await tx.team.update({ where: { id: teamId }, data: { electronicBalance: balanceAfter } });
      await tx.ledgerEntry.create({ data: { sessionId: tender.sessionId, teamId, operationType: "TENDER_PAYOUT", amountSigned: amount, balanceAfter, idempotencyKey: `${tenderId}:${teamId}` } });
      payouts.push({ teamId, amount });
    }
    await tx.tender.update({ where: { id: tenderId }, data: { paidAt: new Date(), closedAt: new Date() } });
    await tx.auditEvent.create({ data: { sessionId: tender.sessionId, actorType: ActorType.SYSTEM, action: "tender.paid", payload: { tenderId, percentage, payouts } } });
  }

  private async settleOpenTenders(tx: Prisma.TransactionClient, sessionId: string, completedQuarter: number, force = false) {
    const tenders = await tx.tender.findMany({ where: { sessionId, paidAt: null, ...(force ? {} : { deadlineQuarter: { lte: completedQuarter } }) }, include: { requirements: true, contributions: true } });
    for (const tender of tenders) {
      const complete = tender.requirements.every((item) => tender.contributions.filter((entry) => entry.resourceTypeId === item.resourceTypeId).reduce((sum, entry) => sum + entry.quantity, 0) >= item.requiredUnits);
      await this.settleTender(tx, tender.id, complete ? 125 : 75);
    }
  }

  async tenders(token: string) {
    const actor = await this.actor(token);
    const participant = actor.role === "PLAYER" ? await this.db.participant.findUniqueOrThrow({ where: { id: actor.id } }) : null;
    if (participant?.disqualifiedAt) throw new ForbiddenException("Участник исключён");
    const [session, tenders] = await Promise.all([
      this.db.gameSession.findUniqueOrThrow({ where: { id: actor.sessionId } }),
      this.db.tender.findMany({ where: { sessionId: actor.sessionId }, orderBy: { createdAt: "desc" }, include: { requirements: { include: { resourceType: true } }, contributions: true } }),
    ]);
    return tenders.map((tender) => {
      const requirements = tender.requirements.map((requirement) => {
        const matching = tender.contributions.filter((item) => item.resourceTypeId === requirement.resourceTypeId);
        return { resourceCode: requirement.resourceType.code, label: requirement.resourceType.label, required: requirement.requiredUnits, collected: matching.reduce((sum, item) => sum + item.quantity, 0), team: matching.filter((item) => item.teamId === participant?.teamId).reduce((sum, item) => sum + item.quantity, 0) };
      });
      const complete = requirements.every((item) => item.collected >= item.required);
      return { id: tender.id, title: tender.title, objectTypeCode: tender.objectTypeCode, deadlineQuarter: tender.deadlineQuarter, paidAt: tender.paidAt?.toISOString() ?? null, status: complete ? "COMPLETED" : tender.closedAt || session.status === SessionStatus.FINISHED || session.currentQuarter > tender.deadlineQuarter ? "CLOSED" : "ACTIVE", requirements };
    });
  }

  async createTender(token: string, input: { title?: unknown; objectTypeCode?: unknown; deadlineQuarter?: unknown; requirements?: unknown; idempotencyKey?: unknown }) {
    const actor = await this.requireTenderEditor(token);
    const { title, objectTypeCode, deadlineQuarter, requirements, idempotencyKey } = input ?? {};
    const entries = Array.isArray(requirements) ? requirements as { resourceCode?: unknown; requiredUnits?: unknown }[] : [];
    if (typeof title !== "string" || !title.trim() || title.trim().length > 80 || (objectTypeCode !== null && objectTypeCode !== undefined && typeof objectTypeCode !== "string") || !Number.isInteger(deadlineQuarter) || entries.length < 1 || entries.length > 6 || entries.some((item) => typeof item.resourceCode !== "string" || !Number.isInteger(item.requiredUnits) || (item.requiredUnits as number) < 1 || (item.requiredUnits as number) > 1_000_000) || new Set(entries.map((item) => item.resourceCode)).size !== entries.length || typeof idempotencyKey !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(idempotencyKey)) throw new BadRequestException("Проверьте название, срок и требования тендера");
    let changed = false;
    await this.db.$transaction(async (tx) => {
      await this.lockSession(tx, actor.sessionId);
      const previous = await tx.tender.findUnique({ where: { sessionId_idempotencyKey: { sessionId: actor.sessionId, idempotencyKey } }, include: { requirements: { include: { resourceType: true } } } });
      if (previous) {
        const sameRequirements = previous.requirements.length === entries.length && entries.every((entry) => previous.requirements.some((requirement) => requirement.resourceType.code === entry.resourceCode && requirement.requiredUnits === entry.requiredUnits));
        if (previous.title !== title.trim() || previous.deadlineQuarter !== deadlineQuarter || (previous.objectTypeCode ?? null) !== (objectTypeCode ?? null) || !sameRequirements) throw new ConflictException("Ключ операции уже использован");
        return;
      }
      const session = await tx.gameSession.findUniqueOrThrow({ where: { id: actor.sessionId } });
      if (session.status !== SessionStatus.WAITING && session.status !== SessionStatus.ACTIVE) throw new ConflictException("Матч завершён");
      if ((deadlineQuarter as number) < Math.max(1, session.currentQuarter) || (deadlineQuarter as number) > session.totalQuarters) throw new BadRequestException("Срок тендера вне игры");
      if (actor.role === "STAFF") {
        const staff = await tx.staffSession.findUniqueOrThrow({ where: { id: actor.id } });
        const station = await tx.stationReadiness.findUniqueOrThrow({ where: { sessionId_stationType: { sessionId: actor.sessionId, stationType: StationType.ENTERPRISES } } });
        if (staff.revokedAt || !station.enabled) throw new ForbiddenException("Нет доступа к предприятиям");
      }
      const resources = await tx.resourceType.findMany({ where: { code: { in: entries.map((item) => item.resourceCode as string) } } });
      if (resources.length !== entries.length) throw new BadRequestException("Неизвестный ресурс");
      if (objectTypeCode && !await tx.objectType.findUnique({ where: { code: objectTypeCode as string } })) throw new BadRequestException("Неизвестный объект");
      const created = await tx.tender.create({ data: { sessionId: actor.sessionId, title: title.trim(), objectTypeCode: objectTypeCode as string | undefined, deadlineQuarter: deadlineQuarter as number, actorId: actor.id, idempotencyKey, requirements: { create: entries.map((item) => ({ resourceTypeId: resources.find((resource) => resource.code === item.resourceCode)!.id, requiredUnits: item.requiredUnits as number })) } } });
      await tx.auditEvent.create({ data: { sessionId: actor.sessionId, actorType: actor.role === "ORGANIZER" ? ActorType.ORGANIZER : ActorType.GAME_MASTER, actorId: actor.id, action: "tender.created", payload: { tenderId: created.id, deadlineQuarter: deadlineQuarter as number } } });
      changed = true;
    });
    if (changed) await this.publish(actor.sessionId);
    return this.tenders(token);
  }

  async contributeTender(token: string, tenderId: string, input: { resourceCode?: unknown; quantity?: unknown; idempotencyKey?: unknown }) {
    const actor = await this.requireRole(token, "PLAYER");
    const { resourceCode, quantity, idempotencyKey } = input ?? {};
    if (typeof tenderId !== "string" || typeof resourceCode !== "string" || !Number.isInteger(quantity) || (quantity as number) < 1 || (quantity as number) > 1_000_000 || typeof idempotencyKey !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(idempotencyKey)) throw new BadRequestException("Проверьте вклад в тендер");
    let changed = false;
    await this.db.$transaction(async (tx) => {
      await this.lockSession(tx, actor.sessionId);
      const tender = await tx.tender.findFirst({ where: { id: tenderId, sessionId: actor.sessionId }, include: { requirements: { include: { resourceType: true } } } });
      if (!tender) throw new NotFoundException("Тендер не найден");
      const participant = await tx.participant.findUniqueOrThrow({ where: { id: actor.id } });
      if (!participant.teamId || participant.disqualifiedAt) throw new ForbiddenException("Нужна действующая команда");
      const requirement = tender.requirements.find((item) => item.resourceType.code === resourceCode);
      if (!requirement) throw new BadRequestException("Ресурс не нужен для тендера");
      const previous = await tx.tenderContribution.findUnique({ where: { tenderId_idempotencyKey: { tenderId, idempotencyKey } } });
      if (previous) {
        if (previous.teamId !== participant.teamId || previous.resourceTypeId !== requirement.resourceTypeId || previous.quantity !== quantity) throw new ConflictException("Ключ операции уже использован");
        return;
      }
      const session = await tx.gameSession.findUniqueOrThrow({ where: { id: actor.sessionId } });
      const timing = session.startsAt ? quarterAt(session.startsAt, session.quarterDurationSec, session.totalQuarters, new Date()) : null;
      if (session.status !== SessionStatus.ACTIVE || !timing || timing.quarter > tender.deadlineQuarter || tender.closedAt) throw new ConflictException("Приём ресурсов завершён");
      const collected = await tx.tenderContribution.aggregate({ where: { tenderId, resourceTypeId: requirement.resourceTypeId }, _sum: { quantity: true } });
      if ((quantity as number) > requirement.requiredUnits - (collected._sum.quantity ?? 0)) throw new ConflictException("Требуется меньше ресурсов");
      const stock = await tx.resourceStock.findUnique({ where: { sessionId_teamId_resourceTypeId: { sessionId: actor.sessionId, teamId: participant.teamId, resourceTypeId: requirement.resourceTypeId } } });
      if (!stock || stock.quantity < (quantity as number)) throw new ConflictException("Недостаточно ресурсов на складе");
      await tx.resourceStock.update({ where: { sessionId_teamId_resourceTypeId: { sessionId: actor.sessionId, teamId: participant.teamId, resourceTypeId: requirement.resourceTypeId } }, data: { quantity: { decrement: quantity as number } } });
      await tx.tenderContribution.create({ data: { tenderId, teamId: participant.teamId, resourceTypeId: requirement.resourceTypeId, quantity: quantity as number, idempotencyKey } });
      await tx.auditEvent.create({ data: { sessionId: actor.sessionId, actorType: ActorType.PLAYER, actorId: actor.id, action: "tender.contributed", payload: { tenderId, teamId: participant.teamId, resourceCode, quantity: quantity as number } } });
      const contributions = await tx.tenderContribution.findMany({ where: { tenderId } });
      const complete = tender.requirements.every((item) => contributions.filter((entry) => entry.resourceTypeId === item.resourceTypeId).reduce((sum, entry) => sum + entry.quantity, 0) >= item.requiredUnits);
      if (complete) await this.settleTender(tx, tenderId, 125);
      changed = true;
    });
    if (changed) await this.publish(actor.sessionId);
    return this.tenders(token);
  }

  async closeTender(token: string, tenderId: string) {
    const actor = await this.requireTenderEditor(token);
    let changed = false;
    await this.db.$transaction(async (tx) => {
      await this.lockSession(tx, actor.sessionId);
      const tender = await tx.tender.findFirst({ where: { id: tenderId, sessionId: actor.sessionId } });
      if (!tender) throw new NotFoundException("Тендер не найден");
      if (tender.closedAt) return;
      const session = await tx.gameSession.findUniqueOrThrow({ where: { id: actor.sessionId } });
      if (session.status !== SessionStatus.ACTIVE) throw new ConflictException("Тендер можно закрыть только во время матча");
      await this.settleTender(tx, tenderId, 75);
      await tx.auditEvent.create({ data: { sessionId: actor.sessionId, actorType: actor.role === "ORGANIZER" ? ActorType.ORGANIZER : ActorType.GAME_MASTER, actorId: actor.id, action: "tender.closed", payload: { tenderId } } });
      changed = true;
    });
    if (changed) await this.publish(actor.sessionId);
    return this.tenders(token);
  }

  private async requireStation(token: string, stationType: StationType) {
    const actor = await this.requireRole(token, "STAFF");
    if (actor.stationType !== stationType) throw new ForbiddenException("Нет доступа к структуре");
    const station = await this.db.stationReadiness.findUnique({ where: { sessionId_stationType: { sessionId: actor.sessionId, stationType } } });
    if (!station?.enabled) throw new ForbiddenException("Структура отключена");
    return actor;
  }

  async patents(token: string) {
    const actor = await this.requireStation(token, StationType.PATENT_OFFICE);
    const items = await this.db.patent.findMany({ where: { sessionId: actor.sessionId }, orderBy: { createdAt: "desc" } });
    return items.map((item) => ({ id: item.id, teamId: item.teamId, name: item.name, industry: item.industry, duration: item.duration, coefficient: item.coefficientBasisPoints / 10000, registeredQuarter: item.registeredQuarter }));
  }

  async registerPatent(token: string, input: { teamId?: unknown; name?: unknown; industry?: unknown; duration?: unknown; coefficient?: unknown; idempotencyKey?: unknown }) {
    const actor = await this.requireStation(token, StationType.PATENT_OFFICE);
    const { teamId, name, industry, duration, coefficient, idempotencyKey } = input ?? {};
    const industries = ["Энергетика", "Жильё", "Газовая отрасль", "Металлургия", "Деревообработка", "Угольная отрасль"];
    if (typeof teamId !== "string" || typeof name !== "string" || name.trim().length < 3 || name.trim().length > 80 || !industries.includes(industry as string) || !Number.isInteger(duration) || (duration as number) < 1 || (duration as number) > 4 || typeof coefficient !== "number" || !Number.isFinite(coefficient) || coefficient < 1.1 || coefficient > 2 || typeof idempotencyKey !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(idempotencyKey)) throw new BadRequestException("Проверьте параметры патента");
    let changed = false;
    await this.db.$transaction(async (tx) => {
      await this.lockSession(tx, actor.sessionId);
      const previous = await tx.patent.findUnique({ where: { sessionId_idempotencyKey: { sessionId: actor.sessionId, idempotencyKey } } });
      if (previous) {
        if (previous.teamId !== teamId || previous.name !== name.trim() || previous.industry !== industry || previous.duration !== duration || previous.coefficientBasisPoints !== Math.round(coefficient * 10000)) throw new ConflictException("Ключ операции уже использован");
        return;
      }
      const session = await tx.gameSession.findUniqueOrThrow({ where: { id: actor.sessionId } });
      if (session.status === SessionStatus.FINISHED) throw new ConflictException("Матч завершён");
      const station = await tx.stationReadiness.findUniqueOrThrow({ where: { sessionId_stationType: { sessionId: actor.sessionId, stationType: StationType.PATENT_OFFICE } } });
      const staff = await tx.staffSession.findUniqueOrThrow({ where: { id: actor.id } });
      if (!station.enabled || staff.revokedAt) throw new ForbiddenException("Нет доступа к науке");
      const team = await tx.team.findFirst({ where: { id: teamId, sessionId: actor.sessionId } });
      if (!team) throw new NotFoundException("Команда не найдена");
      const quarter = Math.max(1, session.currentQuarter);
      const all = await tx.patent.findMany({ where: { sessionId: actor.sessionId, teamId }, select: { registeredQuarter: true, duration: true } });
      if (all.filter((patent) => quarter < patent.registeredQuarter + patent.duration).length >= 2) throw new ConflictException("У команды уже два действующих патента");
      const created = await tx.patent.create({ data: { sessionId: actor.sessionId, teamId, name: name.trim(), industry: industry as string, duration: duration as number, coefficientBasisPoints: Math.round(coefficient * 10000), registeredQuarter: quarter, idempotencyKey, actorId: actor.id } });
      await tx.auditEvent.create({ data: { sessionId: actor.sessionId, actorType: ActorType.GAME_MASTER, actorId: actor.id, action: "patent.registered", payload: { patentId: created.id, teamId } } });
      changed = true;
    });
    if (changed) await this.publish(actor.sessionId);
    return this.patents(token);
  }

  async medicalEvents(token: string) {
    const actor = await this.requireStation(token, StationType.MEDICINE);
    const items = await this.db.medicalEvent.findMany({ where: { sessionId: actor.sessionId }, include: { teams: true }, orderBy: { createdAt: "desc" } });
    return items.map((item) => ({ id: item.id, title: item.title, duration: item.duration, status: item.status, teamIds: item.teams.map((team) => team.teamId), createdAt: item.createdAt, startedAt: item.startedAt, finishedAt: item.finishedAt }));
  }

  async createMedicalEvent(token: string, input: { idempotencyKey?: unknown }) {
    const actor = await this.requireStation(token, StationType.MEDICINE);
    const key = input?.idempotencyKey;
    if (typeof key !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(key)) throw new BadRequestException("Некорректный ключ операции");
    let changed = false;
    await this.db.$transaction(async (tx) => {
      await this.lockSession(tx, actor.sessionId);
      if (await tx.medicalEvent.findUnique({ where: { sessionId_idempotencyKey: { sessionId: actor.sessionId, idempotencyKey: key } } })) return;
      const session = await tx.gameSession.findUniqueOrThrow({ where: { id: actor.sessionId } });
      if (session.status === SessionStatus.FINISHED) throw new ConflictException("Матч завершён");
      const station = await tx.stationReadiness.findUniqueOrThrow({ where: { sessionId_stationType: { sessionId: actor.sessionId, stationType: StationType.MEDICINE } } });
      const staff = await tx.staffSession.findUniqueOrThrow({ where: { id: actor.id } });
      if (!station.enabled || staff.revokedAt) throw new ForbiddenException("Нет доступа к медицине");
      const created = await tx.medicalEvent.create({ data: { sessionId: actor.sessionId, idempotencyKey: key, actorId: actor.id } });
      await tx.auditEvent.create({ data: { sessionId: actor.sessionId, actorType: ActorType.GAME_MASTER, actorId: actor.id, action: "medical.created", payload: { eventId: created.id } } });
      changed = true;
    });
    if (changed) await this.publish(actor.sessionId);
    return this.medicalEvents(token);
  }

  async updateMedicalEvent(token: string, id: string, input: { title?: unknown; duration?: unknown; teamIds?: unknown }) {
    const actor = await this.requireStation(token, StationType.MEDICINE);
    const { title, duration, teamIds } = input ?? {};
    if (typeof title !== "string" || title.trim().length > 80 || !Number.isInteger(duration) || (duration as number) < 1 || (duration as number) > 20 || !Array.isArray(teamIds) || teamIds.some((teamId) => typeof teamId !== "string") || new Set(teamIds).size !== teamIds.length) throw new BadRequestException("Проверьте параметры события");
    await this.db.$transaction(async (tx) => {
      await this.lockSession(tx, actor.sessionId);
      const event = await tx.medicalEvent.findFirst({ where: { id, sessionId: actor.sessionId } });
      if (!event) throw new NotFoundException("Событие не найдено");
      if (event.status !== "draft") throw new ConflictException("Можно изменить только черновик");
      const session = await tx.gameSession.findUniqueOrThrow({ where: { id: actor.sessionId } });
      if (session.status === SessionStatus.FINISHED) throw new ConflictException("Матч завершён");
      const teams = await tx.team.findMany({ where: { sessionId: actor.sessionId, id: { in: teamIds as string[] } } });
      if (teams.length !== teamIds.length) throw new BadRequestException("Команда не найдена");
      await tx.medicalEventTeam.deleteMany({ where: { eventId: id } });
      await tx.medicalEvent.update({ where: { id }, data: { title: title.trim(), duration: duration as number, teams: { create: teams.map((team) => ({ teamId: team.id })) } } });
      await tx.auditEvent.create({ data: { sessionId: actor.sessionId, actorType: ActorType.GAME_MASTER, actorId: actor.id, action: "medical.updated", payload: { eventId: id } } });
    });
    await this.publish(actor.sessionId);
    return this.medicalEvents(token);
  }

  async transitionMedicalEvent(token: string, id: string, target: "active" | "finished") {
    const actor = await this.requireStation(token, StationType.MEDICINE);
    let changed = false;
    await this.db.$transaction(async (tx) => {
      await this.lockSession(tx, actor.sessionId);
      const event = await tx.medicalEvent.findFirst({ where: { id, sessionId: actor.sessionId }, include: { teams: true } });
      if (!event) throw new NotFoundException("Событие не найдено");
      if (event.status === target) return;
      if (target === "active" && (event.status !== "draft" || event.title.length < 3 || !event.teams.length)) throw new ConflictException("Заполните параметры события");
      if (target === "finished" && event.status !== "active") throw new ConflictException("Событие ещё не запущено");
      const session = await tx.gameSession.findUniqueOrThrow({ where: { id: actor.sessionId } });
      if (session.status !== SessionStatus.ACTIVE) throw new ConflictException("Матч не идёт");
      await tx.medicalEvent.update({ where: { id }, data: target === "active" ? { status: target, startedAt: new Date() } : { status: target, finishedAt: new Date() } });
      await tx.auditEvent.create({ data: { sessionId: actor.sessionId, actorType: ActorType.GAME_MASTER, actorId: actor.id, action: `medical.${target}`, payload: { eventId: id } } });
      changed = true;
    });
    if (changed) await this.publish(actor.sessionId);
    return this.medicalEvents(token);
  }

  async recordAssetPurchase(token: string, input: { teamId?: unknown; objectTypeId?: unknown; quantity?: unknown; unitPrice?: unknown; idempotencyKey?: unknown }) {
    const actor = await this.requireRole(token, "STAFF");
    if (actor.stationType !== StationType.CONSTRUCTION) throw new ForbiddenException("Покупки подтверждает строительство");
    const { teamId, objectTypeId, quantity, unitPrice, idempotencyKey } = input ?? {};
    const totalPrice = Number(quantity) * Number(unitPrice);
    if (typeof teamId !== "string" || typeof objectTypeId !== "string" || !Number.isInteger(quantity) || (quantity as number) < 1 || (quantity as number) > 100 || !Number.isInteger(unitPrice) || (unitPrice as number) <= 0 || (unitPrice as number) > 1_000_000 || !Number.isSafeInteger(totalPrice) || totalPrice > 2_147_483_647 || totalPrice % 500 !== 0 || typeof idempotencyKey !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(idempotencyKey)) throw new BadRequestException("Проверьте количество (от 1 до 100) и итоговую сумму (кратна 500 ₽)");
    let changed = false;
    await this.db.$transaction(async (tx) => {
      await this.lockSession(tx, actor.sessionId);
      const previous = await tx.ownedObject.findUnique({ where: { sessionId_idempotencyKey: { sessionId: actor.sessionId, idempotencyKey } } });
      if (previous) {
        if (previous.teamId !== teamId || previous.objectTypeId !== objectTypeId || previous.quantity !== quantity || previous.unitPrice !== unitPrice) throw new ConflictException("Ключ операции уже использован для другой покупки");
        return;
      }
      const session = await tx.gameSession.findUniqueOrThrow({ where: { id: actor.sessionId } });
      const staff = await tx.staffSession.findUnique({ where: { id: actor.id } });
      const station = await tx.stationReadiness.findUnique({ where: { sessionId_stationType: { sessionId: actor.sessionId, stationType: StationType.CONSTRUCTION } } });
      if (session.status !== SessionStatus.ACTIVE || !session.startsAt || staff?.revokedAt || !station?.enabled) throw new ConflictException("Покупки доступны только в активном матче");
      const timing = quarterAt(session.startsAt, session.quarterDurationSec, session.totalQuarters, new Date());
      if (!timing) throw new ConflictException("Все кварталы завершились");
      const [team, objectType, count, price] = await Promise.all([
        tx.team.findFirst({ where: { id: teamId, sessionId: actor.sessionId } }),
        tx.objectType.findFirst({ where: { id: objectTypeId, active: true } }),
        tx.ownedObject.aggregate({ where: { sessionId: actor.sessionId, objectTypeId }, _sum: { quantity: true } }),
        tx.objectPrice.findUnique({ where: { sessionId_objectTypeId: { sessionId: actor.sessionId, objectTypeId } } }),
      ]);
      if (!team || !objectType) throw new NotFoundException("Команда или тип постройки не найдены");
      const currentPrice = price?.currentPrice ?? objectType.purchaseBasePrice + (count._sum.quantity ?? 0) * this.objectPriceStep(objectType.productionRules);
      const nextPrice = currentPrice + (quantity as number) * this.objectPriceStep(objectType.productionRules);
      if (!Number.isSafeInteger(nextPrice) || nextPrice <= 0 || nextPrice > 2_147_483_647) throw new ConflictException("Цена объекта недоступна");
      await tx.ownedObject.create({ data: { sessionId: actor.sessionId, teamId, objectTypeId, quantity: quantity as number, unitPrice: unitPrice as number, totalPrice, builtInQuarter: timing.quarter, firstProductionQuarter: timing.firstProductionQuarter, idempotencyKey } });
      await tx.objectPrice.upsert({ where: { sessionId_objectTypeId: { sessionId: actor.sessionId, objectTypeId } }, create: { sessionId: actor.sessionId, objectTypeId, currentPrice: nextPrice }, update: { currentPrice: nextPrice } });
      await tx.auditEvent.create({ data: { sessionId: actor.sessionId, actorType: ActorType.GAME_MASTER, actorId: actor.id, action: "asset.purchased", payload: { teamId, objectTypeId, quantity: quantity as number, unitPrice: unitPrice as number, totalPrice, payment: "cash", quarter: timing.quarter, firstProductionQuarter: timing.firstProductionQuarter } } });
      changed = true;
    });
    if (changed) await this.publish(actor.sessionId);
    return this.snapshot(token);
  }

  private async bankActor(token: string) {
    const actor = await this.requireRole(token, "STAFF");
    if (actor.stationType !== StationType.BANK) throw new ForbiddenException("Доступно только банку");
    const station = await this.db.stationReadiness.findUnique({ where: { sessionId_stationType: { sessionId: actor.sessionId, stationType: StationType.BANK } } });
    if (!station?.enabled) throw new ForbiddenException("Банк отключён");
    return actor;
  }

  async bankLoans(token: string) {
    const actor = await this.bankActor(token);
    const [session, loans] = await Promise.all([
      this.db.gameSession.findUniqueOrThrow({ where: { id: actor.sessionId } }),
      this.db.loan.findMany({ where: { sessionId: actor.sessionId }, orderBy: { createdAt: "desc" }, include: { payments: { orderBy: { createdAt: "desc" } } } }),
    ]);
    return loans.map((loan) => ({
      id: loan.id, teamId: loan.teamId, principal: loan.principal, rate: loan.rateBasisPoints / 100,
      quarters: loan.quarters, total: loan.totalDue, remaining: loan.remaining ? loanPayoff(loan, session.currentQuarter).due : 0, delivery: loan.delivery,
      issuedQuarter: loan.issuedQuarter, createdAt: loan.createdAt.toISOString(),
      paymentPerQuarter: loanQuote(loan.principal, loan.rateBasisPoints, loan.quarters).paymentPerQuarter,
      payments: loan.payments.map((payment) => ({ id: payment.id, amount: payment.amount, remainingAfter: payment.remainingAfter, createdAt: payment.createdAt.toISOString() })),
    }));
  }

  async issueLoan(token: string, input: { teamId?: unknown; principal?: unknown; rate?: unknown; quarters?: unknown; delivery?: unknown; idempotencyKey?: unknown }) {
    const actor = await this.bankActor(token);
    const { teamId, principal, rate, quarters, delivery, idempotencyKey } = input ?? {};
    const rateBasisPoints = Number(rate) * 100;
    if (typeof teamId !== "string" || !Number.isInteger(principal) || (principal as number) < 500 || (principal as number) > 1_000_000 || (principal as number) % 500 !== 0 || !Number.isInteger(rateBasisPoints) || rateBasisPoints < 0 || rateBasisPoints > 2000 || !Number.isInteger(quarters) || (quarters as number) < 1 || (quarters as number) > 10 || (delivery !== "cash" && delivery !== "balance") || typeof idempotencyKey !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(idempotencyKey)) throw new BadRequestException("Проверьте условия кредита");
    const quote = loanQuote(principal as number, rateBasisPoints, quarters as number);
    let changed = false;
    await this.db.$transaction(async (tx) => {
      await this.lockSession(tx, actor.sessionId);
      const previous = await tx.loan.findUnique({ where: { sessionId_idempotencyKey: { sessionId: actor.sessionId, idempotencyKey } } });
      if (previous) {
        if (previous.teamId !== teamId || previous.principal !== principal || previous.rateBasisPoints !== rateBasisPoints || previous.quarters !== quarters || previous.delivery !== delivery) throw new ConflictException("Ключ операции уже использован");
        return;
      }
      const session = await tx.gameSession.findUniqueOrThrow({ where: { id: actor.sessionId } });
      const staff = await tx.staffSession.findUniqueOrThrow({ where: { id: actor.id } });
      const station = await tx.stationReadiness.findUniqueOrThrow({ where: { sessionId_stationType: { sessionId: actor.sessionId, stationType: StationType.BANK } } });
      if (session.status !== SessionStatus.ACTIVE || !session.startsAt || staff.revokedAt || !station.enabled) throw new ConflictException("Кредиты доступны только в активном матче");
      const timing = quarterAt(session.startsAt, session.quarterDurationSec, session.totalQuarters, new Date());
      if (!timing) throw new ConflictException("Матч завершён");
      const team = await tx.team.findFirst({ where: { id: teamId, sessionId: actor.sessionId } });
      if (!team) throw new NotFoundException("Команда не найдена");
      const activeLoan = await tx.loan.findFirst({ where: { sessionId: actor.sessionId, teamId, remaining: { gt: 0 } } });
      if (activeLoan) throw new ConflictException("У команды уже есть активный кредит");
      const loan = await tx.loan.create({ data: { sessionId: actor.sessionId, teamId, principal: principal as number, principalRemaining: principal as number, rateBasisPoints, quarters: quarters as number, totalDue: quote.totalDue, remaining: principal as number, delivery, issuedQuarter: timing.quarter, interestThroughQuarter: timing.quarter - 1, idempotencyKey, actorId: actor.id } });
      if (delivery === "balance") {
        const balanceAfter = team.electronicBalance + (principal as number);
        if (balanceAfter > 2_147_483_647) throw new ConflictException("Превышен лимит баланса");
        await tx.team.update({ where: { id: teamId }, data: { electronicBalance: balanceAfter } });
        await tx.ledgerEntry.create({ data: { sessionId: actor.sessionId, teamId, operationType: "BANK_LOAN_DISBURSEMENT", amountSigned: principal as number, balanceAfter, idempotencyKey, actorId: actor.id } });
      }
      await tx.auditEvent.create({ data: { sessionId: actor.sessionId, actorType: ActorType.GAME_MASTER, actorId: actor.id, action: "bank.loan.issued", payload: { loanId: loan.id, teamId, principal: principal as number, rate: rate as number, quarters: quarters as number, totalDue: quote.totalDue, delivery } } });
      changed = true;
    });
    if (changed) await this.publish(actor.sessionId);
    return this.bankLoans(token);
  }

  async repayLoan(token: string, loanId: string, input: { amount?: unknown; idempotencyKey?: unknown }) {
    const actor = await this.actor(token);
    if (actor.role === "STAFF" && actor.stationType !== StationType.BANK || actor.role === "ORGANIZER") throw new ForbiddenException("Погашение доступно банку и команде-заёмщику");
    const { amount, idempotencyKey } = input ?? {};
    if (typeof loanId !== "string" || !Number.isInteger(amount) || (amount as number) <= 0 || typeof idempotencyKey !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(idempotencyKey)) throw new BadRequestException("Проверьте сумму погашения");
    let changed = false;
    await this.db.$transaction(async (tx) => {
      await this.lockSession(tx, actor.sessionId);
      const loan = await tx.loan.findFirst({ where: { id: loanId, sessionId: actor.sessionId } });
      if (!loan) throw new NotFoundException("Кредит не найден");
      if (actor.role === "PLAYER") {
        const participant = await tx.participant.findUniqueOrThrow({ where: { id: actor.id } });
        if (participant.disqualifiedAt || participant.teamId !== loan.teamId) throw new ForbiddenException("Погасить кредит может только команда-заёмщик");
      }
      const previous = await tx.loanPayment.findUnique({ where: { loanId_idempotencyKey: { loanId, idempotencyKey } } });
      if (previous) {
        if (previous.amount !== amount) throw new ConflictException("Ключ операции уже использован");
        return;
      }
      const session = await tx.gameSession.findUniqueOrThrow({ where: { id: actor.sessionId } });
      if (session.status !== SessionStatus.ACTIVE) throw new ConflictException("Погашение доступно только в активном матче");
      if (actor.role === "STAFF") {
        const staff = await tx.staffSession.findUniqueOrThrow({ where: { id: actor.id } });
        const station = await tx.stationReadiness.findUniqueOrThrow({ where: { sessionId_stationType: { sessionId: actor.sessionId, stationType: StationType.BANK } } });
        if (staff.revokedAt || !station.enabled) throw new ForbiddenException("Банк недоступен");
      }
      const payoff = loanPayoff(loan, session.currentQuarter);
      if ((amount as number) > payoff.due) throw new ConflictException("Сумма больше суммы досрочного погашения");
      const payment = applyLoanPayment(payoff, amount as number);
      if (actor.role === "PLAYER") {
        const team = await tx.team.findUniqueOrThrow({ where: { id: loan.teamId } });
        if (team.electronicBalance < (amount as number)) throw new ConflictException("Недостаточно средств на балансе команды");
        const balanceAfter = team.electronicBalance - (amount as number);
        await tx.team.update({ where: { id: team.id }, data: { electronicBalance: balanceAfter } });
        await tx.ledgerEntry.create({ data: { sessionId: actor.sessionId, teamId: team.id, operationType: "PLAYER_LOAN_REPAYMENT", amountSigned: -(amount as number), balanceAfter, idempotencyKey, actorId: actor.id } });
      }
      await tx.loan.update({ where: { id: loanId }, data: { remaining: payment.remaining, principalRemaining: payment.principalRemaining, accruedInterest: payment.accruedInterest, interestThroughQuarter: payoff.throughQuarter } });
      await tx.loanPayment.create({ data: { loanId, amount: amount as number, remainingAfter: payment.remaining, idempotencyKey, actorId: actor.id } });
      await tx.auditEvent.create({ data: { sessionId: actor.sessionId, actorType: actor.role === "PLAYER" ? ActorType.PLAYER : ActorType.GAME_MASTER, actorId: actor.id, action: "bank.loan.repaid", payload: { loanId, teamId: loan.teamId, amount: amount as number, remainingAfter: payment.remaining, interestPaid: payment.interestPaid, principalPaid: payment.principalPaid, payment: actor.role === "PLAYER" ? "balance" : "cash" } } });
      changed = true;
    });
    if (changed) await this.publish(actor.sessionId);
    return actor.role === "PLAYER" ? this.snapshot(token) : this.bankLoans(token);
  }

  async finish(token: string) {
    const actor = await this.requireRole(token, "ORGANIZER");
    await this.db.$transaction(async (tx) => {
      await this.lockSession(tx, actor.sessionId);
      const session = await tx.gameSession.findUniqueOrThrow({ where: { id: actor.sessionId } });
      if (session.status === SessionStatus.FINISHED) return;
      await this.settleOpenTenders(tx, actor.sessionId, session.currentQuarter, true);
      await this.recordScoreSnapshot(tx, actor.sessionId, session.currentQuarter, MatchSnapshotPhase.FINAL);
      await tx.gameSession.update({ where: { id: actor.sessionId }, data: { status: SessionStatus.FINISHED } });
      await tx.auditEvent.create({ data: { sessionId: actor.sessionId, actorType: ActorType.ORGANIZER, action: "session.finished", payload: {} } });
    });
    await this.publish(actor.sessionId);
    return this.snapshot(token);
  }

  private async projectorCredential(displayToken: string) {
    if (displayToken.length < 32) throw new UnauthorizedException("Projector token is missing");
    const credential = await this.db.joinCredential.findFirst({ where: {
      purpose: CredentialPurpose.PUBLIC_DISPLAY, usesLimit: null, secretHash: this.tokenHash(displayToken), revokedAt: null,
    } });
    if (!credential) throw new UnauthorizedException("Invalid projector token");
    return credential.sessionId;
  }

  private async ensureProjectorAccess(sessionId: string) {
    const existing = await this.db.joinCredential.findMany({ where: { sessionId, purpose: CredentialPurpose.PUBLIC_DISPLAY, revokedAt: null } });
    const display = existing.find((item) => item.usesLimit === null);
    const code = existing.find((item) => item.usesLimit === 1);
    if (display && code) return { displayToken: this.decrypt(display.secretCipher), code: this.decrypt(code.secretCipher) };
    return this.db.$transaction(async (tx) => {
      await this.lockSession(tx, sessionId);
      await tx.projectorState.upsert({ where: { sessionId }, create: { sessionId }, update: {} });
      const current = await tx.joinCredential.findMany({ where: { sessionId, purpose: CredentialPurpose.PUBLIC_DISPLAY, revokedAt: null } });
      let currentDisplay = current.find((item) => item.usesLimit === null);
      let currentCode = current.find((item) => item.usesLimit === 1);
      if (!currentDisplay) {
        const value = this.token();
        currentDisplay = await tx.joinCredential.create({ data: {
          sessionId, purpose: CredentialPurpose.PUBLIC_DISPLAY,
          secretHash: this.tokenHash(value), secretCipher: this.encrypt(value),
        } });
      }
      if (!currentCode) {
        const value = this.staffCode();
        currentCode = await tx.joinCredential.create({ data: {
          sessionId, purpose: CredentialPurpose.PUBLIC_DISPLAY, usesLimit: 1,
          secretHash: this.codeHash(value), secretCipher: this.encrypt(value),
        } });
      }
      return { displayToken: this.decrypt(currentDisplay.secretCipher), code: this.decrypt(currentCode.secretCipher) };
    });
  }

  async loginProjector(codeInput: unknown) {
    if (typeof codeInput !== "string") throw new BadRequestException("Enter the projector code");
    const code = codeInput.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) throw new UnauthorizedException("Invalid projector code");
    const credential = await this.db.joinCredential.findFirst({ where: {
      purpose: CredentialPurpose.PUBLIC_DISPLAY, usesLimit: 1, secretHash: this.codeHash(code), revokedAt: null,
      session: { status: { in: [SessionStatus.WAITING, SessionStatus.ACTIVE] } },
    } });
    if (!credential) throw new UnauthorizedException("Invalid projector code");
    const access = await this.ensureProjectorAccess(credential.sessionId);
    return { token: access.displayToken, sessionId: credential.sessionId };
  }

  private async projectorSelection(sessionId: string) {
    const [state, session, resources, teams] = await Promise.all([
      this.db.projectorState.findUnique({ where: { sessionId } }),
      this.db.gameSession.findUniqueOrThrow({ where: { id: sessionId }, select: { status: true, currentQuarter: true, totalQuarters: true, quarterDurationSec: true, startsAt: true } }),
      this.db.resourceType.findMany({ where: { yields: { some: {} } }, orderBy: { label: "asc" }, select: { code: true, label: true } }),
      this.db.team.findMany({ where: { sessionId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    ]);
    const screens = [
      { key: "overview", label: "Отрасли" },
      ...resources.map((item) => ({ key: `resource:${item.code}`, label: item.label })),
      ...teams.map((item) => ({ key: `team:${item.id}`, label: item.name })),
    ];
    const selected = screens.some((item) => item.key === state?.screen) ? state!.screen : "overview";
    const elapsed = state?.automatic ? Math.max(0, Date.now() - state.changedAt.getTime()) : 0;
    const steps = Math.floor(elapsed / 15000);
    const index = (screens.findIndex((item) => item.key === selected) + steps) % screens.length;
    return {
      screen: state?.automatic ? screens[index].key : selected,
      automatic: state?.automatic ?? false,
      nextSwitchAt: state?.automatic ? state.changedAt.getTime() + (steps + 1) * 15000 : null,
      screens, status: session.status, currentQuarter: session.currentQuarter, totalQuarters: session.totalQuarters,
      quarterDurationSec: session.quarterDurationSec, startsAt: session.startsAt?.toISOString() ?? null,
      serverTime: Date.now(),
    };
  }

  async projectorAdmin(token: string) {
    const actor = await this.requireRole(token, "ORGANIZER");
    const { displayToken } = await this.ensureProjectorAccess(actor.sessionId);
    return { ...await this.projectorSelection(actor.sessionId), displayToken };
  }

  async projectorAdminState(token: string) {
    const actor = await this.requireRole(token, "ORGANIZER");
    return this.projectorSelection(actor.sessionId);
  }

  async setProjector(token: string, input: { screen?: unknown; automatic?: unknown }) {
    const actor = await this.requireRole(token, "ORGANIZER");
    if (input.screen === undefined && input.automatic === undefined) throw new BadRequestException("Nothing to update");
    if (input.automatic !== undefined && typeof input.automatic !== "boolean") throw new BadRequestException("Invalid automatic setting");
    if (input.screen !== undefined) {
      if (typeof input.screen !== "string") throw new BadRequestException("Invalid screen");
      const selection = await this.projectorSelection(actor.sessionId);
      if (!selection.screens.some((item) => item.key === input.screen)) throw new BadRequestException("Screen is not available");
    }
    const currentScreen = input.automatic === false && input.screen === undefined
      ? (await this.projectorSelection(actor.sessionId)).screen : undefined;
    await this.db.projectorState.upsert({
      where: { sessionId: actor.sessionId },
      create: { sessionId: actor.sessionId, screen: typeof input.screen === "string" ? input.screen : currentScreen ?? "overview", automatic: input.automatic === true },
      update: { ...(typeof input.screen === "string" || currentScreen ? { screen: input.screen as string ?? currentScreen } : {}), ...(typeof input.automatic === "boolean" ? { automatic: input.automatic } : {}), changedAt: new Date() },
    });
    await this.db.auditEvent.create({ data: { sessionId: actor.sessionId, actorType: ActorType.ORGANIZER, action: "projector.changed", payload: input as Prisma.InputJsonValue } });
    return this.projectorSelection(actor.sessionId);
  }

  async projectorState(displayToken: string) {
    return this.projectorSelection(await this.projectorCredential(displayToken));
  }

  async projectorData(displayToken: string) {
    const sessionId = await this.projectorCredential(displayToken);
    const [session, resources, teams, runs] = await Promise.all([
      this.db.gameSession.findUniqueOrThrow({ where: { id: sessionId }, select: { currentQuarter: true, status: true } }),
      this.db.resourceType.findMany({ where: { yields: { some: {} } }, orderBy: { label: "asc" }, select: { code: true, label: true, yields: { select: { objectType: { select: { code: true } } } } } }),
      this.db.team.findMany({
        where: { sessionId }, orderBy: { createdAt: "asc" },
        include: { ownedObjects: { include: { objectType: { include: { yields: { include: { resourceType: { select: { code: true } } } } } } } } },
      }),
      this.db.quarterRun.findMany({ where: { sessionId, status: "COMMITTED" }, orderBy: { quarterNumber: "desc" }, take: 5, include: { productionLines: true } }),
    ]);
    return {
      status: session.status, quarter: session.currentQuarter,
      resources: resources.map((resource) => ({ code: resource.code, label: resource.label, objectCodes: [...new Set(resource.yields.map((yieldRule) => yieldRule.objectType.code))] })),
      teams: teams.map((team) => {
        const production: Record<string, number> = {};
        const buildings: Record<string, number> = {};
        for (const asset of team.ownedObjects) {
          buildings[asset.objectType.code] = (buildings[asset.objectType.code] ?? 0) + asset.quantity;
          if (asset.firstProductionQuarter > session.currentQuarter || session.status === SessionStatus.WAITING) continue;
          for (const yieldRule of asset.objectType.yields) {
            const code = yieldRule.resourceType.code;
            production[code] = (production[code] ?? 0) + asset.quantity * yieldRule.unitsPerQuarter;
          }
        }
        return { id: team.id, name: team.name, color: team.color, avatar: team.avatar, production, buildings, assetsCount: team.ownedObjects.reduce((sum, asset) => sum + asset.quantity, 0) };
      }),
      history: runs.reverse().map((run) => ({ quarter: run.quarterNumber, teams: Object.fromEntries(teams.map((team) => [team.id, run.productionLines.filter((line) => line.teamId === team.id).reduce((sum, line) => sum + line.producedUnits, 0)])) })),
    };
  }

  async connect(socket: Socket) {
    const token = typeof socket.handshake.auth.token === "string" ? socket.handshake.auth.token : "";
    const actor = await this.actor(token);
    socket.data.actor = actor;
    socket.data.token = token;
    socket.join(actor.sessionId);
    if (actor.role === "STAFF") await this.updateReadiness(actor, true);
    socket.emit("lobby:snapshot", await this.snapshot(token));
    socket.on("skyline:ping", (ack?: (response: { ok: boolean; serverTime: number }) => void) => ack?.({ ok: true, serverTime: Date.now() }));
    socket.on("disconnect", () => { void this.disconnect(actor, socket.id); });
  }

  private async disconnect(actor: Actor, socketId: string) {
    if (actor.role !== "STAFF") return;
    const stillOnline = [...(this.io?.sockets.sockets.values() ?? [])].some((socket) => socket.id !== socketId && socket.connected && socket.data.actor?.id === actor.id);
    if (!stillOnline) await this.updateReadiness(actor, false);
  }

  private async updateReadiness(actor: Actor, ready: boolean) {
    if (!actor.stationType) return;
    await this.db.stationReadiness.updateMany({ where: { sessionId: actor.sessionId, stationType: actor.stationType, enabled: true }, data: { ready, lastSeenAt: new Date() } });
    await this.publish(actor.sessionId);
  }

  private async advanceDueSessions() {
    if (this.clockSyncing) return;
    this.clockSyncing = true;
    try {
      const active = await this.db.gameSession.findMany({ where: { status: SessionStatus.ACTIVE, startsAt: { not: null } }, select: { id: true, startsAt: true, currentQuarter: true, quarterDurationSec: true, totalQuarters: true, quarterRuns: { orderBy: { quarterNumber: "desc" }, take: 1, select: { quarterNumber: true, status: true } } } });
      for (const session of active) {
        const now = new Date();
        const completed = completedQuarters(session.startsAt!, session.quarterDurationSec, session.totalQuarters, now);
        const expired = sessionExpired(session.startsAt!, session.quarterDurationSec, session.totalQuarters, now);
        if (!expired && completed < session.currentQuarter) continue;
        if (!expired && completed === session.totalQuarters && session.currentQuarter === session.totalQuarters && session.quarterRuns[0]?.status === "COMMITTED") continue;
        const changed = await this.db.$transaction(async (tx) => {
          await this.lockSession(tx, session.id);
          const current = await tx.gameSession.findUniqueOrThrow({ where: { id: session.id } });
          if (current.status !== SessionStatus.ACTIVE || !current.startsAt) return false;
          const at = new Date();
          const due = completedQuarters(current.startsAt, current.quarterDurationSec, current.totalQuarters, at);
          let produced = false;
          for (let quarter = 1; quarter <= due; quarter++) {
            if (!await settleQuarter(tx, current.id, quarter, current.configVersion)) continue;
            produced = true;
            await tx.auditEvent.create({ data: { sessionId: current.id, actorType: ActorType.SYSTEM, action: "quarter.production.committed", payload: { quarter } } });
            await this.settleOpenTenders(tx, current.id, quarter);
            await this.recordScoreSnapshot(tx, current.id, quarter, MatchSnapshotPhase.QUARTER);
            if (quarter < current.totalQuarters) await tx.quarterRun.upsert({ where: { sessionId_quarterNumber: { sessionId: current.id, quarterNumber: quarter + 1 } }, create: { sessionId: current.id, quarterNumber: quarter + 1, status: "STARTED", ruleVersion: current.configVersion }, update: {} });
          }
          await this.settleOpenTenders(tx, current.id, due, sessionExpired(current.startsAt, current.quarterDurationSec, current.totalQuarters, at));
          const nextQuarter = Math.min(current.totalQuarters, Math.max(1, due + 1));
          const finished = sessionExpired(current.startsAt, current.quarterDurationSec, current.totalQuarters, at);
          if (!produced && !finished && nextQuarter === current.currentQuarter) return false;
          if (finished) await this.recordScoreSnapshot(tx, current.id, nextQuarter, MatchSnapshotPhase.FINAL);
          await tx.gameSession.update({ where: { id: current.id }, data: { currentQuarter: nextQuarter, ...(finished ? { status: SessionStatus.FINISHED } : {}) } });
          if (nextQuarter !== current.currentQuarter) await tx.auditEvent.create({ data: { sessionId: current.id, actorType: ActorType.SYSTEM, action: "quarter.time.advanced", payload: { quarter: nextQuarter } } });
          if (finished) await tx.auditEvent.create({ data: { sessionId: current.id, actorType: ActorType.SYSTEM, action: "session.time.expired", payload: { quarter: nextQuarter } } });
          return true;
        });
        if (changed) await this.publish(session.id);
      }
    } finally { this.clockSyncing = false; }
  }

  private async publish(sessionId: string, started = false) {
    if (!this.io) return;
    await this.db.gameSession.update({ where: { id: sessionId }, data: { eventSequence: { increment: 1 } } });
    for (const socket of this.io.sockets.sockets.values()) {
      if (socket.data.actor?.sessionId !== sessionId) continue;
      try {
        const state = await this.snapshot(socket.data.token);
        socket.emit("lobby:snapshot", state);
        if (started) socket.emit("match:started", state);
      } catch { socket.disconnect(true); }
    }
  }
}
