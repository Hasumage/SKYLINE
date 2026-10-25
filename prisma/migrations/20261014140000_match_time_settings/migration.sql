ALTER TABLE "game_sessions"
  ADD COLUMN "total_quarters" INTEGER NOT NULL DEFAULT 10;

ALTER TABLE "game_sessions"
  ALTER COLUMN "quarter_duration_sec" SET DEFAULT 300;
