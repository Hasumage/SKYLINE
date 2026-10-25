CREATE TABLE "projector_states" (
    "session_id" UUID NOT NULL,
    "screen" TEXT NOT NULL DEFAULT 'overview',
    "automatic" BOOLEAN NOT NULL DEFAULT false,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projector_states_pkey" PRIMARY KEY ("session_id")
);

ALTER TABLE "projector_states" ADD CONSTRAINT "projector_states_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
