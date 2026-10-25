ALTER TYPE "StationType" ADD VALUE 'ENTERPRISES';
ALTER TYPE "StationType" ADD VALUE 'MAYOR';

ALTER TABLE "game_sessions"
  ADD COLUMN "organizer_token_hash" TEXT NOT NULL,
  ADD COLUMN "event_sequence" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "join_credentials" ADD COLUMN "secret_cipher" TEXT NOT NULL;
ALTER TABLE "participants" ADD COLUMN "disqualified_at" TIMESTAMP(3);
ALTER TABLE "staff_sessions"
  ADD COLUMN "session_token_hash" TEXT NOT NULL,
  ADD COLUMN "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "station_readiness" ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX "game_sessions_organizer_token_hash_key" ON "game_sessions"("organizer_token_hash");
CREATE UNIQUE INDEX "staff_sessions_session_token_hash_key" ON "staff_sessions"("session_token_hash");
CREATE UNIQUE INDEX "staff_sessions_game_session_id_station_type_key" ON "staff_sessions"("game_session_id", "station_type");
CREATE UNIQUE INDEX "game_sessions_one_unfinished_key" ON "game_sessions" ((true))
  WHERE "status" IN ('DRAFT', 'WAITING', 'ACTIVE', 'PAUSED');
