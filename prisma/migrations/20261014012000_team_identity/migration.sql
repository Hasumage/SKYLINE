ALTER TABLE "teams"
  ADD COLUMN "code" TEXT NOT NULL,
  ADD COLUMN "color" TEXT NOT NULL DEFAULT '#087cff',
  ADD COLUMN "avatar" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "teams_session_id_code_key" ON "teams"("session_id", "code");
