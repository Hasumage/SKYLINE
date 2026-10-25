ALTER TABLE "tenders" ADD COLUMN "idempotency_key" TEXT NOT NULL;
CREATE UNIQUE INDEX "tenders_session_id_idempotency_key_key" ON "tenders"("session_id", "idempotency_key");
