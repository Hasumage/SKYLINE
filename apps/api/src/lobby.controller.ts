import { BadRequestException, Body, Controller, Get, Headers, Inject, Param, Patch, Post, UnauthorizedException } from "@nestjs/common";
import { StationType } from "@prisma/client";
import { LobbyService } from "./lobby.service.js";

@Controller()
export class LobbyController {
  constructor(@Inject(LobbyService) private readonly lobby: LobbyService) {}

  private token(authorization?: string) {
    const token = authorization?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token) throw new UnauthorizedException("Требуется токен устройства");
    return token;
  }

  @Post("admin/login")
  adminLogin(@Body() body: { code?: unknown }) {
    if (typeof body?.code !== "string") throw new BadRequestException("Введите команду или код");
    return body.code === "create" ? this.lobby.createSession(body.code) : this.lobby.loginStaff(body.code);
  }

  @Post("lobby/join")
  join(@Body() body: { code?: unknown; deviceId?: unknown }) {
    if (typeof body?.code !== "string" || typeof body?.deviceId !== "string") throw new BadRequestException("Введите код сессии");
    return this.lobby.joinPlayer(body.code, body.deviceId);
  }

  @Get("auth/me")
  me(@Headers("authorization") authorization?: string) {
    return this.lobby.snapshot(this.token(authorization));
  }

  @Get("admin/projector")
  projectorAdmin(@Headers("authorization") authorization?: string) {
    return this.lobby.projectorAdmin(this.token(authorization));
  }

  @Patch("admin/projector")
  setProjector(@Headers("authorization") authorization: string | undefined, @Body() body: { screen?: unknown; automatic?: unknown }) {
    return this.lobby.setProjector(this.token(authorization), body);
  }

  @Get("admin/projector/state")
  projectorAdminState(@Headers("authorization") authorization?: string) {
    return this.lobby.projectorAdminState(this.token(authorization));
  }

  @Get("projector/state")
  projectorState(@Headers("authorization") authorization?: string) {
    return this.lobby.projectorState(this.token(authorization));
  }

  @Post("projector/login")
  projectorLogin(@Body() body: { code?: unknown }) {
    return this.lobby.loginProjector(body?.code);
  }

  @Get("projector/data")
  projectorData(@Headers("authorization") authorization?: string) {
    return this.lobby.projectorData(this.token(authorization));
  }

  @Post("lobby/teams")
  createTeam(@Headers("authorization") authorization: string | undefined, @Body() body: { name: string; color: string; avatar: number; playerName: string }) {
    return this.lobby.createTeam(this.token(authorization), body);
  }

  @Post("lobby/teams/:id/join")
  joinTeam(@Headers("authorization") authorization: string | undefined, @Param("id") id: string, @Body() body: { playerName: string }) {
    return this.lobby.joinTeam(this.token(authorization), id, body?.playerName);
  }

  @Post("lobby/leave-team")
  leaveTeam(@Headers("authorization") authorization?: string) {
    return this.lobby.leaveTeam(this.token(authorization));
  }

  @Patch("admin/stations/:type")
  station(@Headers("authorization") authorization: string | undefined, @Param("type") type: StationType, @Body() body: { enabled?: unknown }) {
    if (typeof body?.enabled !== "boolean") throw new BadRequestException("Укажите состояние структуры");
    return this.lobby.setStation(this.token(authorization), type, body.enabled);
  }

  @Post("admin/stations/:type/kick")
  kickStaff(@Headers("authorization") authorization: string | undefined, @Param("type") type: StationType) {
    return this.lobby.kickStaff(this.token(authorization), type);
  }

  @Patch("admin/players/:id/team")
  move(@Headers("authorization") authorization: string | undefined, @Param("id") id: string, @Body() body: { teamId?: unknown }) {
    if (typeof body?.teamId !== "string") throw new BadRequestException("Укажите команду");
    return this.lobby.movePlayer(this.token(authorization), id, body.teamId);
  }

  @Post("admin/players/:id/disqualify")
  disqualify(@Headers("authorization") authorization: string | undefined, @Param("id") id: string) {
    return this.lobby.disqualifyPlayer(this.token(authorization), id);
  }

  @Post("admin/start")
  start(@Headers("authorization") authorization?: string) {
    return this.lobby.start(this.token(authorization));
  }

  @Patch("admin/settings")
  settings(@Headers("authorization") authorization: string | undefined, @Body() body: { totalQuarters?: unknown; quarterDurationMin?: unknown }) {
    return this.lobby.updateSettings(this.token(authorization), body);
  }

  @Post("atm/transactions")
  atmTransaction(@Headers("authorization") authorization: string | undefined, @Body() body: { teamId?: unknown; amount?: unknown; type?: unknown; idempotencyKey?: unknown }) {
    return this.lobby.atmTransaction(this.token(authorization), body);
  }

  @Post("construction/purchases")
  recordAssetPurchase(@Headers("authorization") authorization: string | undefined, @Body() body: { teamId?: unknown; objectTypeId?: unknown; quantity?: unknown; unitPrice?: unknown; idempotencyKey?: unknown }) {
    return this.lobby.recordAssetPurchase(this.token(authorization), body);
  }

  @Get("construction/catalog")
  constructionCatalog(@Headers("authorization") authorization?: string) {
    return this.lobby.constructionCatalog(this.token(authorization));
  }

  @Get("market/catalog")
  marketCatalog(@Headers("authorization") authorization?: string) {
    return this.lobby.marketCatalog(this.token(authorization));
  }

  @Post("market/purchases")
  marketPurchase(@Headers("authorization") authorization: string | undefined, @Body() body: { objectTypeId?: unknown; quantity?: unknown; idempotencyKey?: unknown }) {
    return this.lobby.marketPurchase(this.token(authorization), body);
  }

  @Get("market/resources")
  marketResources(@Headers("authorization") authorization?: string) {
    return this.lobby.marketResources(this.token(authorization));
  }

  @Post("market/resources/sales")
  sellResources(@Headers("authorization") authorization: string | undefined, @Body() body: { resourceCode?: unknown; quantity?: unknown; expectedUnitPrice?: unknown; idempotencyKey?: unknown }) {
    return this.lobby.sellResources(this.token(authorization), body);
  }

  @Get("tenders")
  tenders(@Headers("authorization") authorization?: string) {
    return this.lobby.tenders(this.token(authorization));
  }

  @Post("tenders")
  createTender(@Headers("authorization") authorization: string | undefined, @Body() body: { title?: unknown; objectTypeCode?: unknown; deadlineQuarter?: unknown; requirements?: unknown; idempotencyKey?: unknown }) {
    return this.lobby.createTender(this.token(authorization), body);
  }

  @Post("tenders/:id/contributions")
  contributeTender(@Headers("authorization") authorization: string | undefined, @Param("id") id: string, @Body() body: { resourceCode?: unknown; quantity?: unknown; idempotencyKey?: unknown }) {
    return this.lobby.contributeTender(this.token(authorization), id, body);
  }

  @Post("tenders/:id/close")
  closeTender(@Headers("authorization") authorization: string | undefined, @Param("id") id: string) {
    return this.lobby.closeTender(this.token(authorization), id);
  }

  @Get("science/patents")
  patents(@Headers("authorization") authorization?: string) {
    return this.lobby.patents(this.token(authorization));
  }

  @Post("science/patents")
  registerPatent(@Headers("authorization") authorization: string | undefined, @Body() body: { teamId?: unknown; name?: unknown; industry?: unknown; duration?: unknown; coefficient?: unknown; idempotencyKey?: unknown }) {
    return this.lobby.registerPatent(this.token(authorization), body);
  }

  @Get("medicine/events")
  medicalEvents(@Headers("authorization") authorization?: string) {
    return this.lobby.medicalEvents(this.token(authorization));
  }

  @Post("medicine/events")
  createMedicalEvent(@Headers("authorization") authorization: string | undefined, @Body() body: { idempotencyKey?: unknown }) {
    return this.lobby.createMedicalEvent(this.token(authorization), body);
  }

  @Patch("medicine/events/:id")
  updateMedicalEvent(@Headers("authorization") authorization: string | undefined, @Param("id") id: string, @Body() body: { title?: unknown; duration?: unknown; teamIds?: unknown }) {
    return this.lobby.updateMedicalEvent(this.token(authorization), id, body);
  }

  @Post("medicine/events/:id/start")
  startMedicalEvent(@Headers("authorization") authorization: string | undefined, @Param("id") id: string) {
    return this.lobby.transitionMedicalEvent(this.token(authorization), id, "active");
  }

  @Post("medicine/events/:id/finish")
  finishMedicalEvent(@Headers("authorization") authorization: string | undefined, @Param("id") id: string) {
    return this.lobby.transitionMedicalEvent(this.token(authorization), id, "finished");
  }

  @Get("bank/loans")
  bankLoans(@Headers("authorization") authorization?: string) {
    return this.lobby.bankLoans(this.token(authorization));
  }

  @Post("bank/loans")
  issueLoan(@Headers("authorization") authorization: string | undefined, @Body() body: { teamId?: unknown; principal?: unknown; rate?: unknown; quarters?: unknown; delivery?: unknown; idempotencyKey?: unknown }) {
    return this.lobby.issueLoan(this.token(authorization), body);
  }

  @Post("bank/loans/:id/payments")
  repayLoan(@Headers("authorization") authorization: string | undefined, @Param("id") id: string, @Body() body: { amount?: unknown; idempotencyKey?: unknown }) {
    return this.lobby.repayLoan(this.token(authorization), id, body);
  }

  @Post("admin/finish")
  finish(@Headers("authorization") authorization?: string) {
    return this.lobby.finish(this.token(authorization));
  }
}
