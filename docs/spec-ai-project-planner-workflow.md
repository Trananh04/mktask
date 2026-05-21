# Spec: Workflow AI lập kế hoạch dự án và tự tạo task

## Giả định hiện tại

1. Người dùng muốn nhập một mô tả dự án bằng tiếng Việt, ví dụ: "Làm website bán hàng cho cửa hàng mỹ phẩm trong 6 tuần".
2. AI sẽ phân tích mô tả, đề xuất cấu trúc dự án, chia công việc, ước lượng độ ưu tiên/thời hạn, rồi gợi ý người phụ trách phù hợp.
3. Hệ thống phải cho người dùng xem và duyệt kế hoạch trước khi tự tạo project/task thật.
4. AI không được tự ý thêm người mới vào tổ chức nếu chưa có lời mời hoặc chưa có tài khoản. "Tự thêm người" nên hiểu là tự gán thành viên hiện có vào project/task.
5. Nếu muốn AI chọn đúng người theo năng lực, dự án cần có dữ liệu kỹ năng, vai trò chuyên môn, tải công việc hiện tại và lịch rảnh của từng thành viên.

## Mục tiêu

Xây một workflow trong mktask cho phép người quản lý mô tả dự án một lần, sau đó AI tạo bản nháp kế hoạch gồm:

- Workspace hoặc project cần tạo.
- Danh sách task/subtask.
- Loại task, độ ưu tiên, trạng thái ban đầu.
- Timeline, sprint hoặc milestone nếu có.
- Người phụ trách phù hợp cho từng task.
- Lý do AI chọn người đó.
- Cảnh báo nếu thiếu thông tin, thiếu thành viên phù hợp hoặc workload quá tải.

Người dùng có thể chỉnh sửa bản nháp rồi bấm "Tạo dự án" để hệ thống gọi API hiện có và tạo dữ liệu thật.

## Dự án hiện có những gì

### Frontend

- Next.js frontend.
- Có trang quản lý project, task, workspace, member, settings.
- Có AI Chat panel hiện hữu trong `frontend/src/components/chat/ChatPanel.tsx`.
- Có AI settings modal trong `frontend/src/components/settings/AISettings.tsx`.
- Có các API client cho project/task/workspace/member trong `frontend/src/utils/api`.
- Có context cho auth, workspace, project, task.

### Backend

- NestJS backend.
- Prisma schema đã có:
  - `Organization`
  - `Workspace`
  - `Project`
  - `Task`
  - `OrganizationMember`
  - `WorkspaceMember`
  - `ProjectMember`
  - `TaskAssignee`
  - `TaskReporter`
  - `Workflow`
  - `TaskStatus`
- Backend đã có module `ai-chat`.
- Backend đã có module `ai-agent-client`.
- Backend đã có API tạo project/task/member theo cấu trúc hiện tại.

### AI Agent

- Thuật toán phân tích workload đã được đưa vào backend NestJS.
- Có endpoint backend `/api/ai-agent/analyze` chạy nội bộ, không cần FastAPI riêng.
- Có test cho service phân tích workload nội bộ.
- Logic hiện tại đã nghĩ theo hướng:
  - Member có `skills`.
  - Task có required skills.
  - AI chọn người có skill phù hợp và ít tải việc hơn.

## Phần còn thiếu

### 1. Hồ sơ năng lực thành viên

Hiện Prisma `User` có `bio`, `preferences`, `onboardInfo`, nhưng chưa có model chuẩn cho kỹ năng. Cần thêm một trong hai hướng:

Hướng nhanh:

- Lưu skill trong `User.onboardInfo` hoặc `User.preferences`.
- Ví dụ:

```json
{
  "skills": ["frontend", "react", "ui", "testing"],
  "roleTags": ["developer"],
  "weeklyCapacityHours": 30,
  "seniority": "mid"
}
```

Hướng chuẩn hơn:

- Tạo model mới:
  - `Skill`
  - `UserSkill`
  - `MemberCapacity`
- Có UI cho admin nhập kỹ năng và năng lực từng người.

Khuyến nghị: bắt đầu bằng hướng nhanh, sau đó tách model khi workflow ổn.

### 2. API lập kế hoạch dự án bằng AI

Cần thêm backend endpoint:

```text
POST /api/ai-project-planner/plan
```

Input:

```json
{
  "organizationId": "uuid",
  "workspaceId": "uuid optional",
  "description": "Mô tả dự án tiếng Việt",
  "targetDeadline": "2026-07-01 optional",
  "preferredTeamMemberIds": ["uuid optional"],
  "constraints": {
    "maxTasks": 50,
    "includeSubtasks": true,
    "createSprintPlan": true
  }
}
```

Output:

```json
{
  "project": {
    "name": "Website bán hàng mỹ phẩm",
    "description": "Xây dựng website bán hàng...",
    "priority": "HIGH",
    "startDate": "2026-05-20",
    "endDate": "2026-07-01"
  },
  "tasks": [
    {
      "title": "Thiết kế giao diện trang chủ",
      "description": "Tạo wireframe và UI...",
      "priority": "HIGH",
      "requiredSkills": ["ui", "figma"],
      "estimateHours": 8,
      "suggestedAssigneeId": "uuid",
      "suggestedAssigneeName": "Nguyễn A",
      "assignmentReason": "Có kỹ năng UI/Figma và workload thấp nhất nhóm.",
      "subtasks": []
    }
  ],
  "warnings": [
    "Không tìm thấy thành viên có kỹ năng SEO."
  ]
}
```

### 3. API áp dụng bản nháp

Cần thêm backend endpoint:

```text
POST /api/ai-project-planner/apply
```

Endpoint này nhận bản nháp đã duyệt và tạo dữ liệu thật:

- Tạo project nếu chưa có.
- Thêm project members nếu cần.
- Tạo task.
- Gán assignee/reporter.
- Tạo sprint/milestone nếu scope có yêu cầu.
- Ghi activity log: "AI đã tạo kế hoạch dự án".

Quan trọng: endpoint này phải chạy trong transaction để tránh tạo nửa chừng.

### 4. UI duyệt kế hoạch

Cần thêm màn hoặc modal:

```text
AI Project Planner
```

Luồng UI:

1. Người dùng nhập mô tả dự án.
2. Chọn tổ chức/workspace.
3. Chọn deadline nếu có.
4. Bấm "Tạo kế hoạch bằng AI".
5. UI hiển thị bản nháp:
   - Thông tin project.
   - Danh sách task.
   - Người phụ trách đề xuất.
   - Cảnh báo.
6. Người dùng chỉnh sửa:
   - Tên project.
   - Task title/description.
   - Assignee.
   - Priority.
   - Deadline.
7. Bấm "Tạo project và task".

Không nên cho AI tạo thẳng ngay từ câu chat đầu tiên nếu chưa có màn duyệt.

## Kiến trúc đề xuất

```text
Frontend Planner UI
  -> Backend ai-project-planner.controller
    -> Collect context từ DB
      - organization members
      - workspace/project members
      - active task counts
      - user skills/capacity
      - workflows/statuses
    -> Gọi AI provider và bộ phân công nội bộ trong backend
    -> Validate JSON plan bằng DTO/Zod/class-validator
    -> Trả plan draft cho frontend

Frontend Review
  -> Backend apply endpoint
    -> Prisma transaction
    -> create project/task/assignee
    -> activity log
```

## Có nên dùng AI Chat hiện có không?

Có, nhưng nên chia thành hai tầng:

1. AI Chat dùng cho thao tác nhanh:
   - "Tạo task A".
   - "Đổi trạng thái task B".
   - "Lọc task ưu tiên cao".

2. AI Project Planner dùng cho kế hoạch lớn:
   - "Lập kế hoạch dự án từ mô tả".
   - "Chia task và phân người".
   - "Duyệt rồi tạo hàng loạt".

Nếu nhét toàn bộ vào ChatPanel ngay, UI sẽ khó kiểm soát và dễ tạo nhầm nhiều task.

## Dữ liệu cần bổ sung

### Thành viên

Cần có ít nhất:

- Kỹ năng: frontend, backend, design, QA, DevOps, content, marketing...
- Vai trò chuyên môn.
- Số giờ làm việc mỗi tuần.
- Task đang active.
- Số task đang quá hạn.
- Project đang tham gia.

### Task

Cần AI sinh thêm:

- Required skills.
- Estimate hours hoặc story points.
- Deadline.
- Dependency nếu có.
- Risk level nếu cần.

### Project

Cần AI sinh thêm:

- Mục tiêu dự án.
- Phạm vi.
- Milestones.
- Tiêu chí hoàn thành.
- Rủi ro.

## Commands

Dev:

```powershell
npm run dev
```

Docker dev:

```powershell
docker-compose -f docker-compose.dev.yml up
```

Frontend lint:

```powershell
npm run lint:frontend
```

Backend test:

```powershell
npm run test:backend
```

AI agent test:

```powershell
npm run test:backend -- ai-agent.service.spec.ts
```

Build frontend:

```powershell
npm run build:frontend
```

## Testing Strategy

### Unit tests

- Test parser/validator cho AI plan JSON.
- Test assignment scoring:
  - skill match.
  - workload thấp.
  - capacity còn trống.
  - fallback khi không có skill phù hợp.

### Backend integration tests

- `POST /api/ai-project-planner/plan` trả draft hợp lệ.
- `POST /api/ai-project-planner/apply` tạo project/task/assignee trong transaction.
- Không tạo dữ liệu nếu draft invalid.
- Không cho user không có quyền tạo project/task.

### Frontend tests

- Nhập mô tả và hiển thị draft.
- Chỉnh sửa assignee trước khi apply.
- Hiển thị cảnh báo thiếu kỹ năng.
- Apply thành công chuyển đến project mới.

## Boundaries

### Always

- Luôn có bước review trước khi tạo dữ liệu thật.
- Luôn validate JSON AI trả về.
- Luôn kiểm tra quyền user trước khi tạo project/task.
- Luôn ghi log hành động AI.
- Luôn cho người dùng sửa assignee trước khi apply.

### Ask first

- Thêm migration Prisma cho skill/capacity.
- Thêm provider AI mới ngoài Gemini/OpenAI/OpenRouter.
- Cho phép AI tự mời người mới qua email.
- Cho phép AI tự tạo workflow/status mới.

### Never

- Không commit API key.
- Không để AI tạo hàng loạt task mà không có xác nhận.
- Không gán task cho người không thuộc organization/project nếu chưa được thêm quyền.
- Không tin JSON từ AI nếu chưa validate.

## Success Criteria

- Người dùng nhập mô tả dự án tiếng Việt và nhận được draft project/task rõ ràng.
- Draft có ít nhất: project name, description, task list, priority, assignee suggestion, reason.
- Người dùng có thể chỉnh sửa draft trước khi tạo.
- Apply tạo project và task thật trong DB.
- Task được gán đúng người hoặc có cảnh báo nếu không đủ dữ liệu.
- Nếu AI lỗi hoặc quota hết, UI báo lỗi rõ và không tạo dữ liệu rác.

## Open Questions

1. Bạn muốn AI tạo một project trong workspace có sẵn hay tự tạo cả workspace mới?
2. Thành viên hiện tại có cần nhập kỹ năng thủ công không, hay muốn AI suy luận từ bio/onboardInfo?
3. Bạn muốn dùng Gemini trực tiếp hay dùng OpenRouter để dễ đổi model?
4. Workflow cần tạo sprint/milestone ngay không, hay chỉ project + task trước?
5. Có cần AI tự mời người chưa có tài khoản qua email không?
6. Người dùng nào được quyền dùng chức năng này: owner/manager hay cả member?

## Đề xuất MVP

Làm phiên bản đầu tiên nhỏ nhưng dùng được:

1. Thêm form "AI lập kế hoạch dự án".
2. Người dùng nhập mô tả + chọn workspace.
3. Backend lấy danh sách member và số task active.
4. AI tạo draft project + task.
5. Gợi ý assignee dựa trên:
   - skills trong `User.onboardInfo`.
   - số task active.
   - role trong project/workspace.
6. Người dùng duyệt.
7. Apply tạo project + task.

Sau MVP mới thêm:

- Skill management UI.
- Capacity theo giờ/tuần.
- Dependency graph.
- Sprint planning.
- Tự mời thành viên.
- Báo cáo workload.
