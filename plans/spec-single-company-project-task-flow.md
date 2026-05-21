# Spec: Single Company Project Task Flow

## Objective
Simplify the product workflow for one company: managers create projects directly, then create tasks and choose assignees. Workspace remains only as an internal backend container where required by the current schema.

## Commands
- Frontend type check: `cd frontend && npx tsc --noEmit --pretty false`
- Frontend lint: `cd frontend && npm run lint`
- Frontend build: `cd frontend && npm run build`

## Project Structure
- `frontend/src/pages/projects` contains the organization-level project list and project routes.
- `frontend/src/components/projects` contains project creation and analytics UI.
- `frontend/src/components/tasks/NewTaskModal.tsx` contains task creation and assignee selection.

## Code Style
```ts
router.push(`/projects/${project.slug}`);
```
Prefer organization-level project/task routes in user-facing UI. Do not expose workspace selection in manager workflows.

## Testing Strategy
Use TypeScript checks for route/component integration. Manually verify manager can create a project, open `/projects/:slug`, create a task, and select assignees.

## Boundaries
- Always: keep existing backend workspace data intact until a database migration is explicitly requested.
- Ask first: deleting workspace tables, migrations, API modules, or historical routes.
- Never: remove existing user data or break old workspace URLs without a migration/redirect plan.

## Success Criteria
- Project list links to `/projects/:projectSlug`.
- Create project modal does not show workspace fields.
- `/workspaces` redirects to `/projects`.
- Project page offers task navigation and task creation.
- Create task modal includes assignee selection.
- Global task filters no longer show workspace.

## Open Questions
- Should backend workspace models be fully removed in a later migration, or kept as a hidden default container?
