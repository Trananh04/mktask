# Spec: Project Governance And Health

## Objective

Add a project governance layer above tasks and sprints so managers can maintain a
project overview, milestones, status updates, risk register entries, task blockers,
and a health report from the project page.

This slice is intentionally focused on governance:

- Project overview stores a goal and scope on the project.
- Milestones track dated project checkpoints.
- Status updates capture weekly health as `ON_TRACK`, `AT_RISK`, or `OFF_TRACK`
  and the user who posted the update.
- Project risks capture a risk register entry with severity and mitigation.
- Tasks can be marked blocked with a reason. Project health exposes blocked tasks,
  blocking dependencies, and overdue open tasks.
- AI project health gathers project status updates, risks, milestones, tasks,
  comments, and daily reports before asking the configured AI provider for a
  weekly summary.

Adjacent roadmap areas remain separate slices:

- Project templates require template-owned workflow, labels, starter tasks, views,
  and automations.
- Custom field definitions already exist in Prisma and task custom-field values
  already exist on tasks; field management and rendering need a dedicated UI/API
  slice.
- Request intake forms, scheduled dashboard reports, and Jira/Trello migration
  workflows require new public or batch workflows and are not folded into the
  governance data model.

## Tech Stack

- Backend: NestJS, Prisma, PostgreSQL
- Frontend: Next.js pages router, React, TypeScript
- AI: existing AI Project Planner provider configuration and provider adapters

## Commands

- Backend tests: `npm run test:backend -- --runInBand`
- Frontend lint: `npm run lint:frontend`
- Backend lint: `npm run lint:backend`
- Full lint: `npm run lint`
- Build: `npm run build`
- Prisma migration: `npm run db:migrate`

## Project Structure

- `backend/prisma/`: governance schema and migration
- `backend/src/modules/projects/`: governance DTOs, service behavior, API routes
- `backend/src/modules/tasks/`: task blocker fields accepted by task updates
- `backend/src/modules/ai-project-planner/`: AI health DTOs and summarization
- `frontend/src/components/projects/`: project overview governance UI
- `frontend/src/components/tasks/`: blocked task editing surface
- `frontend/src/types/` and `frontend/src/utils/api/`: shared client contracts

## Code Style

Follow the existing NestJS DTO/service/controller pattern and keep project access
checks at controller/service boundaries:

```ts
@Patch(':id/overview')
@Scope('PROJECT', 'id')
@Roles(Role.MANAGER, Role.OWNER)
updateOverview(@Param('id') id: string, @Body() dto: UpdateProjectOverviewDto) {
  return this.projectsService.updateOverview(id, dto);
}
```

Frontend controls should stay on the real project surface, use existing UI
components, and avoid placeholder navigation.

## Testing Strategy

- Add backend unit tests first for deterministic project health facts and
  governance service writes.
- Add backend tests for AI project health prompt normalization where practical
  without calling external providers.
- Use the existing lint/build gates for frontend contract and component changes.
- Manual runtime verification is optional when local infra is unavailable; build
  and tests remain required.

## Boundaries

- Always: validate DTO input, preserve project scope/role checks, write focused
  tests for new service behavior, keep AI provider calls mocked in tests.
- Ask first: split out template/intake/migration workflows into their own slices
  if the first governance slice becomes too large.
- Never: bypass project access controls, store secrets in project content, or let
  AI create project data without the existing user approval flows.

## Success Criteria

- A manager can update project goal/scope from the project page.
- A project can have milestones, risks, and weekly status updates with API and UI
  support.
- A task can store blocked state and blocked reason, and project health reports
  blocked and overdue work.
- A manager can request an AI weekly health report for a project using project
  data gathered by the backend.
- Backend tests, lint, and build checks attempted for the changed surface.

## Open Questions

None for this slice. The follow-up roadmap slices above should be sized and
implemented independently after this governance layer lands.
