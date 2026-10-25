ALTER TABLE "participants" ADD COLUMN "device_id_hash" TEXT;
CREATE UNIQUE INDEX "participants_device_id_hash_key" ON "participants"("device_id_hash");
