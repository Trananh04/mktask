-- CreateTable
CREATE TABLE "chat_conversation_read_states" (
    "conversation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "last_read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_conversation_read_states_pkey" PRIMARY KEY ("conversation_id","user_id")
);

-- CreateIndex
CREATE INDEX "chat_conversation_read_states_user_id_last_read_at_idx" ON "chat_conversation_read_states"("user_id", "last_read_at");

-- AddForeignKey
ALTER TABLE "chat_conversation_read_states" ADD CONSTRAINT "chat_conversation_read_states_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversation_read_states" ADD CONSTRAINT "chat_conversation_read_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
