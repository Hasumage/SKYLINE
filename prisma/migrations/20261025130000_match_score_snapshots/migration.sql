CREATE TYPE "MatchSnapshotPhase" AS ENUM ('START', 'QUARTER', 'FINAL');

CREATE TABLE "match_score_snapshots" (
    "session_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "phase" "MatchSnapshotPhase" NOT NULL,
    "quarter_number" INTEGER NOT NULL,
    "team_name" TEXT NOT NULL,
    "balance" INTEGER NOT NULL,
    "assets_count" INTEGER NOT NULL,
    "stock_units" INTEGER NOT NULL,
    "building_points" INTEGER NOT NULL,
    "resource_points" INTEGER NOT NULL,
    "debt" INTEGER NOT NULL,
    "debt_deduction" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "is_winner" BOOLEAN NOT NULL,
    "rule_version" INTEGER NOT NULL DEFAULT 1,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_score_snapshots_pkey" PRIMARY KEY ("session_id","phase","quarter_number","team_id")
);

CREATE INDEX "match_score_snapshots_session_id_quarter_number_idx" ON "match_score_snapshots"("session_id","quarter_number");
CREATE INDEX "match_score_snapshots_team_id_quarter_number_idx" ON "match_score_snapshots"("team_id","quarter_number");

ALTER TABLE "match_score_snapshots" ADD CONSTRAINT "match_score_snapshots_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "match_score_snapshots" ADD CONSTRAINT "match_score_snapshots_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
