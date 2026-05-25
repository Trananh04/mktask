# Spec: Internal Chat MVP

## Objective

Add an internal chat surface that fits the existing organization, workspace, and project hierarchy.
The first release supports:

- Project conversations for project members shown from the global chat screen.
- Workspace conversations for workspace members shown from the global chat screen.
- Direct messages between users who share an organization.
- Realtime delivery for newly created messages.
- Message replies, pinned messages, read receipts, reactions, search, attachments, and creating a
  task from a project chat message.
- Mentions that notify project/workspace conversation members.
- A compact in-app chat UI that follows the existing mktask application layout.

Task comments stay separate from chat so project discussion and task-specific history do not blur
together.

## Tech Stack

- Backend: NestJS, Prisma, PostgreSQL, Socket.IO.
- Frontend: Next.js pages router, React, Tailwind utilities, existing API and socket helpers.

## Commands

- Dev: `npm run dev`
- Backend test: `npm run test:backend`
- Frontend lint: `npm run lint:frontend`
- Backend lint: `npm run lint:backend`
- Build: `npm run build`
- Prisma client: `npm run db:generate`

## Project Structure

- `backend/prisma/schema.prisma`: chat persistence models and enums.
- `backend/src/modules/chat/`: DTOs, controller, service, module, and service tests.
- `backend/src/gateway/`: shared realtime event broadcasting.
- `frontend/src/pages/chat.tsx`: single chat route.
- `frontend/src/components/chat/`: chat workspace UI.
- `frontend/src/lib/`: typed chat API integration.
- `plans/`: implementation specs.

## Code Style

```ts
async sendMessage(conversationId: string, userId: string, content: string) {
  const access = await this.assertConversationAccess(conversationId, userId, 'send');
  return this.prisma.chatMessage.create({
    data: { conversationId: access.conversation.id, senderId: userId, content },
  });
}
```

- Keep authorization checks on the backend service boundary.
- Reuse membership hierarchy instead of inventing a separate organization role system.
- Use explicit DTO validation for API inputs.

## Testing Strategy

- Backend service tests cover project chat visibility, read-only viewers, direct-message
  membership, message persistence, and message list pagination defaults.
- Existing lint and build commands cover integration drift in both workspaces.
- Manual UI verification should cover conversation selection, empty states, composer state,
  and realtime message arrival when sockets are connected.

## Boundaries

- Always: check organization or project membership before returning or creating messages.
- Always: preserve private DM membership even for organization managers.
- Ask first: add organization-wide channels, external chat integrations, message editing/deletion,
  or moderation tooling.
- Never: expose private DM content through project or organization membership alone.
- Never: replace task comments with chat messages.

## Success Criteria

- A project member sees project conversations on the global chat route without opening a project
  first, can read prior messages, and can send a message.
- A project viewer can read the project conversation but cannot send.
- A user can create or reuse a DM only with a user in a shared organization.
- Only DM participants can read or send DM messages.
- New messages are emitted to connected clients subscribed to the conversation.
- Workspace members see workspace conversations; non-members cannot join or read them.
- Project chat messages can be replied to, pinned/unpinned, searched, reacted to, and converted into
  project tasks with inferred title, mentions, and due date when possible.
- Chat file metadata is stored with each message after upload, and project-chat attachments carry
  the project id for later retrieval.
- Mentioned users receive a notification and unread socket event without exposing private
  conversations.
- The frontend exposes a coherent chat page and a project-level entry point without breaking the
  existing sidebar and project templates.

## Open Questions

- Organization-wide channels remain deferred until workspace/project chat is exercised.
- Message editing, deletion, and moderation remain deferred.
