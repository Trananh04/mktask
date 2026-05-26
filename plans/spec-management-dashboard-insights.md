# Spec: Management Dashboard Insights

## Objective

Add a management dashboard layer that helps company managers quickly understand
task volume, department progress, project risk, employee workload, blockers, and
slow work from the existing organization dashboard.

Acceptance criteria:

- Show total active, overdue, and completed tasks.
- Show progress by department, project, and employee. A workspace is treated as a
  department in the current data model.
- Show workload, deadline pressure, and performance signals.
- List projects that are at risk of missing deadlines.
- Summarize project progress, blockers, risks, and delayed tasks.
- Provide a quick management report without requiring an external AI call.

## Tech Stack

- Backend: NestJS, Prisma, PostgreSQL
- Frontend: Next.js pages router, React, TypeScript, Recharts/Tailwind UI

## Commands

- Backend targeted test: `npm run test --workspace=backend -- organization-charts.service.spec.ts --runInBand`
- Frontend lint: `npm run lint --workspace=frontend`
- Backend lint check: `npm run lint:check --workspace=backend`
- Build: `npm run build`

## Project Structure

- Backend chart contract: `backend/src/modules/organizations/dto/get-charts-query.dto.ts`
- Backend aggregation logic: `backend/src/modules/organizations/organizations-charts.service.ts`
- Backend tests: `backend/src/modules/organizations/organizations-charts.service.spec.ts`
- Frontend chart contract: `frontend/src/types/organizations.ts`
- Frontend dashboard state: `frontend/src/contexts/organization-context/index.tsx`
- Frontend widget registry: `frontend/src/utils/data/organizationAnalyticsData.ts`
- Frontend widget UI: `frontend/src/components/charts/dashboard/management-summary-panel.tsx`

## Testing Strategy

- Unit test backend aggregation with deterministic project/task fixtures.
- Verify personal scope does not expose organization-wide management summary.
- Run frontend lint to catch contract/component errors.
- Manually test the dashboard with seeded data and inspect the network response
  for the `management-summary` chart payload.

## Boundaries

- Always: use current organization access rules and existing dashboard chart API.
- Ask first: adding external AI report generation or scheduled email delivery.
- Never: bypass scope filtering or include archived projects/tasks in metrics.

## Success Criteria

- `/organizations/:id/charts` supports `types=management-summary`.
- The dashboard renders a management report widget by default.
- The widget includes task counts, department/project/member progress, risk
  alerts, blockers, and delayed work.
- Backend tests cover the new aggregation behavior.
