# Spec: AI Assistant Guidance Mode

## Objective
Make the in-app AI chat act like a practical mktask assistant instead of only a browser
automation loop. It should explain what it can do, guide the user through mktask
workflows, and keep browser automation for explicit action requests.

## Commands
- Lint: `npm run lint`
- Backend tests: `npm run test:backend -- --runInBand`
- Backend build check: `npx nest build` from `backend`
- Frontend build: `npm run build --workspace=frontend`

## Project Structure
- `backend/src/modules/ai-chat/` contains AI prompts and app guidance context.
- `frontend/src/components/chat/ChatPanel.tsx` routes chat messages into guidance,
  planning, bulk task creation, or browser automation.
- `plans/` stores scoped implementation specs.

## Code Style
```ts
if (isAssistantGuidanceRequest(message)) {
  await handleAssistantGuidance(message);
  return;
}
```

Keep intent routing small and explicit. Keep product guidance in backend prompt/context
files so the assistant behavior stays consistent across UI callers.

## Testing Strategy
- Add backend unit tests for guidance intent and prompt/context behavior.
- Keep frontend changes small and verify with lint and production build.
- Run the full backend suite because the AI chat module shares settings and prompt
  paths with browser automation.

## Boundaries
- Always: preserve permission checks and existing automation clarification behavior.
- Ask first: add new AI providers, direct database-changing AI tools, or schema changes.
- Never: auto-run destructive actions from a help question.

## Success Criteria
- Help/how-to/capability questions use conversational assistant chat instead of the
  browser automation loop.
- The assistant prompt tells the AI to guide users through core mktask workflows,
  answer with clear steps, and distinguish guidance from actions.
- Explicit UI action requests still use browser automation.
- Tests and lint pass for the touched areas.
