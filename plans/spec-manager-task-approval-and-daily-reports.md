# Manager Task Approval and Daily Reports

## Goal

Build an internal manager/member workflow around tasks:

- Members can request a task status change, but the task status only changes after a manager approves it.
- Members submit two task reports per day: start-of-day and end-of-day.
- Managers and super admins get a daily report inbox grouped by employee and date.
- Managers receive notifications when a member submits a status request or daily report.

## Roles

- `MEMBER`: can create projects/tasks where already allowed, can submit task status requests, and can submit daily reports for tasks they can access.
- `MANAGER`, `OWNER`, `SUPER_ADMIN`: can directly change task status, approve/reject member status requests, and review daily reports.

## Backend API

- `POST /tasks/:id/status-requests`: create or reuse a pending member status change request.
- `GET /tasks/status-requests`: manager inbox for pending/all requests, filtered by organization/date/user.
- `PATCH /tasks/status-requests/:requestId/review`: approve or reject a status change request.
- `POST /tasks/:id/daily-reports`: submit a start/end day report for a task.
- `GET /tasks/daily-reports`: manager inbox of daily reports, filtered by organization/date/user/type/status.
- `PATCH /tasks/daily-reports/:reportId/review`: manager marks a report reviewed and can leave a note.

## Data

- `TaskStatusChangeRequest`: task, requested status, requester, reviewer, decision, notes, timestamps.
- `TaskDailyReport`: task, reporter, date, type, content, blockers, progress percent, review note, timestamps.

## Frontend

- Task detail should let members request a status change and submit start/end day reports.
- Manager sidebar gets a `Báo cáo` entry.
- Manager report page shows:
  - pending status requests with approve/reject actions,
  - daily reports grouped by employee for the chosen date,
  - review note action.

## Testing

- Backend unit tests for request creation, approval, rejection, duplicate pending requests, report submission, and manager listing.
- Run affected backend tests, frontend lint/build, and note unrelated lint failures if any remain.
