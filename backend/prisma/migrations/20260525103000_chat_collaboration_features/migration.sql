-- Extend chat conversations to support workspace rooms.
ALTER TYPE "ChatConversationType" ADD VALUE IF NOT EXISTS 'WORKSPACE';

ALTER TABLE "chat_conversations"
ADD COLUMN IF NOT EXISTS "workspace_id" UUID;

ALTER TABLE "chat_conversations"
ADD CONSTRAINT "chat_conversations_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "chat_conversations_workspace_id_type_key"
ON "chat_conversations"("workspace_id", "type");

-- Message collaboration metadata.
ALTER TABLE "chat_messages"
ADD COLUMN IF NOT EXISTS "parent_message_id" UUID,
ADD COLUMN IF NOT EXISTS "is_pinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "pinned_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "pinned_by_id" UUID;

ALTER TABLE "chat_messages"
ADD CONSTRAINT "chat_messages_parent_message_id_fkey"
FOREIGN KEY ("parent_message_id") REFERENCES "chat_messages"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "chat_messages"
ADD CONSTRAINT "chat_messages_pinned_by_id_fkey"
FOREIGN KEY ("pinned_by_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "chat_messages_conversation_id_is_pinned_idx"
ON "chat_messages"("conversation_id", "is_pinned");

CREATE INDEX IF NOT EXISTS "chat_messages_parent_message_id_idx"
ON "chat_messages"("parent_message_id");

CREATE TABLE IF NOT EXISTS "chat_message_mentions" (
    "message_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_message_mentions_pkey" PRIMARY KEY ("message_id","user_id")
);

CREATE INDEX IF NOT EXISTS "chat_message_mentions_user_id_idx"
ON "chat_message_mentions"("user_id");

ALTER TABLE "chat_message_mentions"
ADD CONSTRAINT "chat_message_mentions_message_id_fkey"
FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_message_mentions"
ADD CONSTRAINT "chat_message_mentions_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "chat_message_reactions" (
    "message_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" VARCHAR(24) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_message_reactions_pkey" PRIMARY KEY ("message_id","user_id","type")
);

CREATE INDEX IF NOT EXISTS "chat_message_reactions_message_id_type_idx"
ON "chat_message_reactions"("message_id", "type");

CREATE INDEX IF NOT EXISTS "chat_message_reactions_user_id_idx"
ON "chat_message_reactions"("user_id");

ALTER TABLE "chat_message_reactions"
ADD CONSTRAINT "chat_message_reactions_message_id_fkey"
FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_message_reactions"
ADD CONSTRAINT "chat_message_reactions_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "chat_message_attachments" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "project_id" UUID,
    "workspace_id" UUID,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "url" TEXT,
    "storage_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_message_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "chat_message_attachments_message_id_idx"
ON "chat_message_attachments"("message_id");

CREATE INDEX IF NOT EXISTS "chat_message_attachments_project_id_idx"
ON "chat_message_attachments"("project_id");

CREATE INDEX IF NOT EXISTS "chat_message_attachments_workspace_id_idx"
ON "chat_message_attachments"("workspace_id");

ALTER TABLE "chat_message_attachments"
ADD CONSTRAINT "chat_message_attachments_message_id_fkey"
FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_message_attachments"
ADD CONSTRAINT "chat_message_attachments_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_message_attachments"
ADD CONSTRAINT "chat_message_attachments_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tasks"
ADD COLUMN IF NOT EXISTS "source_chat_message_id" UUID;

ALTER TABLE "tasks"
ADD CONSTRAINT "tasks_source_chat_message_id_fkey"
FOREIGN KEY ("source_chat_message_id") REFERENCES "chat_messages"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
