import { z } from "zod";

export const sessionStatusSchema = z.enum([
  "DRAFT",
  "WAITING",
  "ACTIVE",
  "PAUSED",
  "FINISHED",
]);

export const actorRoleSchema = z.enum([
  "ORGANIZER",
  "GAME_MASTER",
  "PLAYER",
  "PUBLIC_DISPLAY",
]);

export const stationTypeSchema = z.enum([
  "BANK",
  "CONSTRUCTION",
  "ATM",
  "PATENT_OFFICE",
  "MEDICINE",
  "ENTERPRISES",
  "MAYOR",
]);

export const idempotencyKeySchema = z.string().uuid();

export const createTeamSchema = z.object({
  sessionId: z.string().uuid(),
  name: z.string().trim().min(2).max(40),
  idempotencyKey: idempotencyKeySchema,
});

export const joinTeamSchema = z.object({
  sessionId: z.string().uuid(),
  teamId: z.string().uuid(),
  idempotencyKey: idempotencyKeySchema,
});

export const createSessionSchema = z.object({
  name: z.string().trim().min(2).max(80),
  expectedParticipants: z.number().int().min(1).max(200),
  quarterDurationSec: z.number().int().min(60).max(3600).default(360),
});

export type SessionStatus = z.infer<typeof sessionStatusSchema>;
export type ActorRole = z.infer<typeof actorRoleSchema>;
export type StationType = z.infer<typeof stationTypeSchema>;
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type JoinTeamInput = z.infer<typeof joinTeamSchema>;
export type CreateSessionInput = z.infer<typeof createSessionSchema>;

