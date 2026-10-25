CREATE TABLE "patents" (
  "id" UUID NOT NULL,
  "session_id" UUID NOT NULL,
  "team_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "industry" TEXT NOT NULL,
  "duration" INTEGER NOT NULL,
  "coefficient_basis_points" INTEGER NOT NULL,
  "registered_quarter" INTEGER NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "actor_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "patents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "patents_session_id_idempotency_key_key" ON "patents"("session_id", "idempotency_key");
CREATE INDEX "patents_session_id_team_id_idx" ON "patents"("session_id", "team_id");
ALTER TABLE "patents" ADD CONSTRAINT "patents_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "patents" ADD CONSTRAINT "patents_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "medical_events" (
  "id" UUID NOT NULL,
  "session_id" UUID NOT NULL,
  "title" TEXT NOT NULL DEFAULT '',
  "duration" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "idempotency_key" TEXT NOT NULL,
  "actor_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMP(3),
  "finished_at" TIMESTAMP(3),
  CONSTRAINT "medical_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "medical_events_session_id_idempotency_key_key" ON "medical_events"("session_id", "idempotency_key");
CREATE INDEX "medical_events_session_id_status_idx" ON "medical_events"("session_id", "status");
ALTER TABLE "medical_events" ADD CONSTRAINT "medical_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "medical_event_teams" (
  "event_id" UUID NOT NULL,
  "team_id" UUID NOT NULL,
  CONSTRAINT "medical_event_teams_pkey" PRIMARY KEY ("event_id", "team_id")
);
ALTER TABLE "medical_event_teams" ADD CONSTRAINT "medical_event_teams_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "medical_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "medical_event_teams" ADD CONSTRAINT "medical_event_teams_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
