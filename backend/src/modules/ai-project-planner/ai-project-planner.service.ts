import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProjectPriority, Role, TaskPriority, TaskType } from '@prisma/client';
import slugify from 'slugify';
import { PrismaService } from '../../prisma/prisma.service';
import { analyzeWorkload } from '../ai-agent-client/workload-analyzer';
import { ProjectsService } from '../projects/projects.service';
import { SettingsService } from '../settings/settings.service';
import { TasksService } from '../tasks/tasks.service';
import {
  ApplyProjectPlanRequestDto,
  ApplyProjectPlanResponseDto,
  AiProjectReportSummaryDto,
  PlannedProjectDto,
  PlannedTaskDto,
  PlanProjectRequestDto,
  ProjectPlanDto,
  SummarizeReportsRequestDto,
  SummarizeReportsResponseDto,
} from './dto/ai-project-planner.dto';

type Provider = 'openrouter' | 'openai' | 'google' | 'anthropic' | 'ollama' | 'custom';

@Injectable()
export class AiProjectPlannerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
    private readonly projectsService: ProjectsService,
    private readonly tasksService: TasksService,
  ) {}

  async plan(dto: PlanProjectRequestDto, userId: string): Promise<ProjectPlanDto> {
    const workspaceId = await this.resolveWorkspaceId(dto.workspaceId, userId);
    const members = await this.getWorkspaceMembersForPlanning(workspaceId);
    const rawPlan = await this.generatePlanWithAi(dto.description, members, userId);
    const normalizedPlan = this.normalizePlan(rawPlan);
    const flatTasks = normalizedPlan.projects.flatMap((project) =>
      project.tasks.map((task) => ({
        id: `${project.id}:${task.id}`,
        title: task.title,
        requiredSkills: task.requiredSkills,
        estimateHours: task.estimateHours || 1,
      })),
    );
    const workload = analyzeWorkload({ members, tasks: flatTasks });
    const assignmentsByTaskId = new Map(workload.assignments.map((item) => [item.taskId, item]));

    normalizedPlan.projects = normalizedPlan.projects.map((project) => ({
      ...project,
      tasks: project.tasks.map((task) => {
        const assignment = assignmentsByTaskId.get(`${project.id}:${task.id}`);
        return assignment
          ? {
              ...task,
              assigneeId: assignment.assigneeId,
              assigneeName: assignment.assigneeName,
              description: this.appendAssignmentReason(task.description, assignment.reason),
            }
          : task;
      }),
    }));
    normalizedPlan.warnings = [...normalizedPlan.warnings, ...workload.warnings];

    return normalizedPlan;
  }

  async apply(
    dto: ApplyProjectPlanRequestDto,
    userId: string,
  ): Promise<ApplyProjectPlanResponseDto> {
    const workspaceId = await this.resolveWorkspaceId(dto.workspaceId, userId);
    const plan = this.normalizePlan(dto.plan);
    const createdProjects: ApplyProjectPlanResponseDto['createdProjects'] = [];
    const createdTasks: ApplyProjectPlanResponseDto['createdTasks'] = [];
    const warnings = [...plan.warnings];

    for (const plannedProject of plan.projects) {
      const project = await this.projectsService.create(
        {
          name: plannedProject.name,
          slug: slugify(plannedProject.name, { lower: true, strict: true }) || plannedProject.id,
          description: plannedProject.description || plan.summary,
          color: '#3B82F6',
          avatar: '',
          priority: ProjectPriority.MEDIUM,
          workspaceId,
        },
        userId,
      );
      createdProjects.push({ id: project.id, name: project.name, slug: project.slug });

      const statusId = await this.getDefaultStatusId(project.workflowId);
      if (!statusId) {
        warnings.push(`Dự án ${project.name} chưa có trạng thái mặc định nên bỏ qua các task.`);
        continue;
      }

      for (const plannedTask of plannedProject.tasks) {
        const assigneeId = dto.createAssignments === false ? undefined : plannedTask.assigneeId;
        if (assigneeId) {
          await this.ensureProjectMember(project.id, assigneeId, userId);
        }
        const task = await this.tasksService.create(
          {
            title: plannedTask.title,
            description: plannedTask.description,
            type: TaskType.TASK,
            priority: this.toTaskPriority(plannedTask.priority),
            storyPoints: this.toOptionalInt(plannedTask.storyPoints),
            originalEstimate: this.toEstimateMinutes(plannedTask.estimateHours),
            remainingEstimate: this.toEstimateMinutes(plannedTask.estimateHours),
            projectId: project.id,
            statusId,
            assigneeIds: assigneeId ? [assigneeId] : [],
            reporterIds: [userId],
            customFields: {
              aiGenerated: true,
              requiredSkills: plannedTask.requiredSkills,
              estimateHours: plannedTask.estimateHours,
            },
          },
          userId,
        );
        createdTasks.push({
          id: task.id,
          title: task.title,
          projectId: project.id,
          assigneeId,
        });
      }
    }

    return { createdProjects, createdTasks, warnings };
  }

  async summarizeReports(
    dto: SummarizeReportsRequestDto,
    userId: string,
  ): Promise<SummarizeReportsResponseDto> {
    const raw = await this.generateReportSummaryWithAi(dto, userId);
    return this.normalizeReportSummary(raw, dto);
  }

  private async generateReportSummaryWithAi(dto: SummarizeReportsRequestDto, userId: string) {
    const isEnabled = await this.settingsService.get('ai_enabled', userId);
    if (isEnabled !== 'true') {
      throw new BadRequestException('Bạn cần bật Trợ lý AI trong cài đặt để tóm tắt báo cáo.');
    }

    const [apiKey, model, rawApiUrl] = await Promise.all([
      this.settingsService.get('ai_api_key', userId),
      this.settingsService.get('ai_model', userId, 'gemini-2.0-flash'),
      this.settingsService.get(
        'ai_api_url',
        userId,
        'https://generativelanguage.googleapis.com/v1beta',
      ),
    ]);
    if (!rawApiUrl || !model) {
      throw new BadRequestException('Bạn cần cấu hình Model và API URL trong cài đặt AI.');
    }

    const provider = this.detectProvider(rawApiUrl);
    if (!apiKey && provider !== 'ollama') {
      throw new BadRequestException('Bạn cần nhập API key trong cài đặt AI.');
    }

    const messages = [
      {
        role: 'system',
        content:
          'Bạn là trợ lý quản lý dự án cho mktask. Hãy đọc báo cáo thô của nhân viên, viết lại rõ ý, tổng hợp vấn đề và đề xuất hành động. Chỉ trả về JSON hợp lệ, không bọc markdown.',
      },
      {
        role: 'user',
        content: this.buildReportSummaryPrompt(dto),
      },
    ];

    const data = await this.callAiProvider(
      rawApiUrl,
      provider,
      String(model),
      apiKey || undefined,
      messages,
    );
    const text = this.extractAiText(provider, data);
    return this.parseJson(text);
  }

  private buildReportSummaryPrompt(dto: SummarizeReportsRequestDto): string {
    const compactProjects = dto.projects.map((project) => ({
      projectId: project.projectId,
      projectName: project.projectName,
      workspaceName: project.workspaceName,
      reports: project.reports.map((report) => ({
        reporterName: report.reporterName,
        taskTitle: report.taskTitle,
        reportType: report.reportType,
        status: report.status,
        progressPercent: report.progressPercent,
        content: report.content,
        blockers: report.blockers,
      })),
      pendingRequests: project.pendingRequests || [],
    }));

    return `Ngày báo cáo: ${dto.date}

Yêu cầu đầu ra JSON:
{
  "overallSummary": "Tóm tắt điều hành ngắn gọn bằng tiếng Việt",
  "projects": [
    {
      "projectId": "id nếu có",
      "projectName": "Tên project",
      "rewrittenSummary": "Viết lại rõ ràng ý chính từ báo cáo thô của nhân viên. Không bịa thêm dữ kiện.",
      "progressAssessment": "Đánh giá tiến độ dựa trên nội dung và progressPercent nếu có",
      "issues": ["Vấn đề/vướng mắc chính"],
      "recommendations": ["Phương án giải quyết cụ thể"],
      "nextActions": ["Hành động tiếp theo nên làm"],
      "riskLevel": "LOW | MEDIUM | HIGH"
    }
  ]
}

Quy tắc:
- Dùng tiếng Việt tự nhiên, rõ ý, phù hợp cho manager đọc nhanh.
- Viết lại nội dung báo cáo thô thành mô tả chuyên nghiệp hơn nhưng giữ đúng ý người báo cáo.
- Nếu người báo cáo viết mơ hồ, hãy nêu rõ là thông tin chưa đủ và đề xuất câu hỏi cần hỏi lại.
- Không tự tạo dữ kiện, deadline, người phụ trách hoặc trạng thái không có trong dữ liệu.
- Mỗi project tối đa 5 issues, 5 recommendations, 5 nextActions.
- riskLevel HIGH nếu có blocker nghiêm trọng hoặc tiến độ thấp dưới 40%; MEDIUM nếu có blocker nhẹ/chờ duyệt/chưa rõ; LOW nếu ổn.

Dữ liệu báo cáo:
${JSON.stringify(compactProjects, null, 2)}`;
  }

  private normalizeReportSummary(
    raw: unknown,
    dto: SummarizeReportsRequestDto,
  ): SummarizeReportsResponseDto {
    const source = this.asRecord(raw);
    const rawProjects = Array.isArray(source.projects) ? source.projects : [];
    const projects: AiProjectReportSummaryDto[] = dto.projects.map((project, index) => {
      const aiProject = this.asRecord(rawProjects[index]) || {};
      const issues = this.asStringArray(aiProject.issues).slice(0, 5);
      const recommendations = this.asStringArray(aiProject.recommendations).slice(0, 5);
      const nextActions = this.asStringArray(aiProject.nextActions).slice(0, 5);
      const riskLevel = this.toRiskLevel(aiProject.riskLevel);

      return {
        projectId: this.asOptionalString(aiProject.projectId) || project.projectId,
        projectName: this.asOptionalString(aiProject.projectName) || project.projectName,
        rewrittenSummary:
          this.asOptionalString(aiProject.rewrittenSummary) ||
          'AI chưa viết lại được báo cáo cho project này.',
        progressAssessment:
          this.asOptionalString(aiProject.progressAssessment) ||
          'Chưa có đủ dữ liệu để đánh giá tiến độ.',
        issues: issues.length > 0 ? issues : ['Chưa phát hiện vấn đề nổi bật.'],
        recommendations:
          recommendations.length > 0
            ? recommendations
            : ['Tiếp tục theo dõi báo cáo và cập nhật tiến độ đều đặn.'],
        nextActions: nextActions.length > 0 ? nextActions : ['Kiểm tra lại báo cáo vào cuối ngày.'],
        riskLevel,
      };
    });

    return {
      overallSummary:
        this.asOptionalString(source.overallSummary) || 'AI đã tổng hợp báo cáo theo từng project.',
      projects,
      generatedAt: new Date().toISOString(),
    };
  }

  private async generatePlanWithAi(
    description: string,
    members: Array<Record<string, unknown>>,
    userId: string,
  ) {
    const isEnabled = await this.settingsService.get('ai_enabled', userId);
    if (isEnabled !== 'true') {
      throw new BadRequestException('Bạn cần bật Trợ lý AI trong cài đặt trước khi lập kế hoạch.');
    }

    const [apiKey, model, rawApiUrl] = await Promise.all([
      this.settingsService.get('ai_api_key', userId),
      this.settingsService.get('ai_model', userId, 'gemini-2.0-flash'),
      this.settingsService.get(
        'ai_api_url',
        userId,
        'https://generativelanguage.googleapis.com/v1beta',
      ),
    ]);
    if (!rawApiUrl || !model) {
      throw new BadRequestException('Bạn cần cấu hình Model và API URL trong cài đặt AI.');
    }

    const provider = this.detectProvider(rawApiUrl);
    if (!apiKey && provider !== 'ollama') {
      throw new BadRequestException('Bạn cần nhập API key trong cài đặt AI.');
    }

    const messages = [
      {
        role: 'system',
        content:
          'Bạn là trợ lý lập kế hoạch dự án cho mktask. Chỉ trả về JSON hợp lệ, không bọc markdown.',
      },
      {
        role: 'user',
        content: this.buildPlannerPrompt(description, members),
      },
    ];

    const data = await this.callAiProvider(
      rawApiUrl,
      provider,
      String(model),
      apiKey || undefined,
      messages,
    );
    const text = this.extractAiText(provider, data);
    return this.parseJson(text);
  }

  private buildPlannerPrompt(description: string, members: Array<Record<string, unknown>>): string {
    return `Hãy phân rã mô tả dự án sau thành kế hoạch triển khai.

Yêu cầu đầu ra JSON:
{
  "summary": "Tóm tắt ngắn bằng tiếng Việt",
  "projects": [
    {
      "id": "project-1",
      "name": "Tên project",
      "description": "Mục tiêu project",
      "tasks": [
        {
          "id": "task-1",
          "title": "Tên task",
          "description": "Mô tả task ngắn",
          "requiredSkills": ["frontend", "react"],
          "estimateHours": 4,
          "storyPoints": 2,
          "priority": "MEDIUM"
        }
      ]
    }
  ],
  "warnings": []
}

Quy tắc:
- Chỉ trả JSON hợp lệ.
- Dùng tiếng Việt cho summary, name, title, description, warnings.
- Tạo từ 3 đến 6 project, mỗi project từ 5 đến 12 task.
- requiredSkills dùng keyword ngắn không dấu nếu phù hợp: frontend, backend, design, qa, devops, database, marketing, content, sales.
- priority chỉ dùng LOWEST, LOW, MEDIUM, HIGH hoặc HIGHEST.
- Không tự bịa assigneeId. Việc phân công sẽ do hệ thống mktask xử lý sau.

Thành viên hiện có để tham khảo kỹ năng:
${JSON.stringify(members, null, 2)}

Mô tả dự án:
${description}`;
  }

  private async callAiProvider(
    apiUrl: string,
    provider: Provider,
    model: string,
    apiKey: string | undefined,
    messages: Array<{ role: string; content: string }>,
  ) {
    let requestUrl = apiUrl.replace(/\/+$/, '');
    const requestHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) requestHeaders.Authorization = `Bearer ${apiKey}`;
    const isGpt5Model = typeof model === 'string' && model.startsWith('gpt-5');
    let requestBody: Record<string, unknown> = {
      model,
      messages,
      temperature: 0.2,
      max_tokens: 2500,
      stream: false,
    };

    if (provider === 'google') {
      requestUrl = `${requestUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey || '')}`;
      delete requestHeaders.Authorization;
      requestBody = {
        contents: messages.map((message) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }],
        })),
        generationConfig: { temperature: 0.2, maxOutputTokens: 2500 },
      };
    } else if (provider === 'anthropic') {
      requestUrl = `${requestUrl}/messages`;
      if (apiKey) requestHeaders['x-api-key'] = apiKey;
      requestHeaders['anthropic-version'] = '2023-06-01';
      delete requestHeaders.Authorization;
      requestBody = {
        model,
        system: messages.find((message) => message.role === 'system')?.content,
        messages: messages.filter((message) => message.role !== 'system'),
        max_tokens: 2500,
        temperature: 0.2,
      };
    } else if (provider === 'openai') {
      requestUrl = `${requestUrl}/chat/completions`;
      delete requestBody.max_tokens;
      requestBody.max_completion_tokens = 2500;
      if (isGpt5Model) {
        delete requestBody.temperature;
      }
    } else if (provider === 'ollama') {
      requestUrl = requestUrl.includes('/v1')
        ? `${requestUrl}/chat/completions`
        : `${requestUrl}/v1/chat/completions`;
      delete requestHeaders.Authorization;
    } else {
      requestUrl = `${requestUrl}/chat/completions`;
    }

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) {
      const errorData = this.asRecord(await response.json().catch(() => ({})));
      const error = this.asRecord(errorData.error);
      throw new BadRequestException(
        this.asOptionalString(error.message) || `Nhà cung cấp AI trả lỗi ${response.status}.`,
      );
    }
    return (await response.json()) as unknown;
  }

  private extractAiText(provider: Provider, data: unknown): string {
    const root = this.asRecord(data);
    if (provider === 'google') {
      const candidate = this.firstRecord(root.candidates);
      const content = this.asRecord(candidate.content);
      const part = this.firstRecord(content.parts);
      return this.asOptionalString(part.text) || '';
    }
    if (provider === 'anthropic') {
      const content = this.firstRecord(root.content);
      return this.asOptionalString(content.text) || '';
    }
    const choice = this.firstRecord(root.choices);
    const message = this.asRecord(choice.message);
    return this.asOptionalString(message.content) || '';
  }

  private parseJson(text: string): unknown {
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/i, '')
      .trim();
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) {
      throw new BadRequestException('AI không trả về JSON kế hoạch hợp lệ.');
    }
    try {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as unknown;
    } catch {
      throw new BadRequestException('Không đọc được JSON kế hoạch từ AI.');
    }
  }

  private normalizePlan(raw: unknown): ProjectPlanDto {
    const source = (raw || {}) as Partial<ProjectPlanDto>;
    const projects = Array.isArray(source.projects) ? source.projects.slice(0, 6) : [];
    return {
      summary: String(source.summary || 'Kế hoạch dự án do AI đề xuất'),
      warnings: Array.isArray(source.warnings) ? source.warnings.map(String) : [],
      projects: projects.map((project, projectIndex) =>
        this.normalizeProject(project as Partial<PlannedProjectDto>, projectIndex),
      ),
    };
  }

  private normalizeProject(project: Partial<PlannedProjectDto>, index: number): PlannedProjectDto {
    const name = String(project.name || `Dự án ${index + 1}`).trim();
    const tasks = Array.isArray(project.tasks) ? project.tasks.slice(0, 12) : [];
    return {
      id: String(project.id || `project-${index + 1}`),
      name,
      description: project.description ? String(project.description) : undefined,
      tasks: tasks.map((task, taskIndex) =>
        this.normalizeTask(task as Partial<PlannedTaskDto>, taskIndex),
      ),
    };
  }

  private normalizeTask(task: Partial<PlannedTaskDto>, index: number): PlannedTaskDto {
    return {
      id: String(task.id || `task-${index + 1}`),
      title: String(task.title || `Công việc ${index + 1}`).trim(),
      description: task.description ? String(task.description) : undefined,
      requiredSkills: Array.isArray(task.requiredSkills)
        ? task.requiredSkills.map(String).filter(Boolean)
        : [],
      estimateHours: this.toOptionalNumber(task.estimateHours) || 1,
      storyPoints: this.toOptionalInt(task.storyPoints),
      priority: this.toTaskPriority(task.priority),
      assigneeId: task.assigneeId ? String(task.assigneeId) : undefined,
      assigneeName: task.assigneeName ? String(task.assigneeName) : undefined,
    };
  }

  private async resolveWorkspaceId(workspaceId: string | undefined, userId: string) {
    if (workspaceId) {
      await this.ensureWorkspaceAccess(workspaceId, userId);
      return workspaceId;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { defaultOrganizationId: true, role: true },
    });
    const configuredOrgId = await this.settingsService.get('default_organization_id');
    const mekongOrg = await this.prisma.organization.findUnique({
      where: { slug: 'mekong' },
      select: { id: true },
    });

    const organizationId =
      user?.defaultOrganizationId ||
      configuredOrgId ||
      mekongOrg?.id ||
      (
        await this.prisma.organizationMember.findFirst({
          where: { userId, organization: { archive: false } },
          orderBy: { createdAt: 'asc' },
          select: { organizationId: true },
        })
      )?.organizationId;

    if (!organizationId) {
      throw new NotFoundException('Khong tim thay to chuc mac dinh.');
    }

    const orgMember = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      select: { role: true },
    });
    if (!orgMember && user?.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Ban khong co quyen dung to chuc mac dinh.');
    }

    let workspace = await this.prisma.workspace.findFirst({
      where: { organizationId, slug: { in: ['mekong', 'projects'] }, archive: false },
      select: { id: true },
    });

    if (!workspace) {
      workspace = await this.prisma.workspace.create({
        data: {
          name: 'Projects',
          slug: 'mekong',
          description: 'Default project workspace for mekong',
          organizationId,
          createdBy: userId,
          updatedBy: userId,
        },
        select: { id: true },
      });
    }

    await this.prisma.workspaceMember.upsert({
      where: { userId_workspaceId: { userId, workspaceId: workspace.id } },
      update: {
        role: orgMember?.role === Role.OWNER ? Role.OWNER : Role.MANAGER,
      },
      create: {
        userId,
        workspaceId: workspace.id,
        role: orgMember?.role === Role.OWNER ? Role.OWNER : Role.MANAGER,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    await this.ensureWorkspaceAccess(workspace.id, userId);
    return workspace.id;
  }

  private async ensureWorkspaceAccess(workspaceId: string, userId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        organizationId: true,
        organization: { select: { ownerId: true } },
        members: { where: { userId }, select: { role: true } },
      },
    });
    if (!workspace) throw new NotFoundException('Không tìm thấy không gian làm việc.');
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const orgMember = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: workspace.organizationId,
        },
      },
      select: { role: true },
    });
    const workspaceRole = workspace.members[0]?.role;
    const canUseAi =
      user?.role === Role.SUPER_ADMIN ||
      user?.role === Role.MANAGER ||
      workspace.organization.ownerId === userId ||
      orgMember?.role === Role.OWNER ||
      orgMember?.role === Role.MANAGER ||
      workspaceRole === Role.OWNER ||
      workspaceRole === Role.MANAGER;
    const isMember = canUseAi;
    if (!isMember) throw new ForbiddenException('Bạn không có quyền dùng workspace này.');
  }

  private async getWorkspaceMembersForPlanning(workspaceId: string) {
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      select: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            preferences: true,
            onboardInfo: true,
            taskAssignees: {
              where: { task: { isArchived: false, completedAt: null } },
              select: { task: { select: { originalEstimate: true } } },
            },
          },
        },
      },
    });

    return members.map(({ user }) => ({
      id: user.id,
      name: `${user.firstName} ${user.lastName}`.trim() || user.email,
      email: user.email,
      skills: this.extractSkills(user.preferences, user.onboardInfo),
      activeTaskCount: user.taskAssignees.length,
      assignedHours: user.taskAssignees.reduce(
        (total, item) => total + (item.task.originalEstimate || 60) / 60,
        0,
      ),
      capacityHours: 40,
    }));
  }

  private extractSkills(...sources: unknown[]): string[] {
    const skills = new Set<string>();
    const visit = (value: unknown) => {
      if (!value) return;
      if (typeof value === 'string') {
        value
          .split(/[,\n]/)
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean)
          .forEach((item) => skills.add(item));
      } else if (Array.isArray(value)) {
        value.forEach(visit);
      } else if (typeof value === 'object') {
        Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
          if (['skills', 'skill', 'expertise', 'role', 'position'].includes(key.toLowerCase())) {
            visit(child);
          }
        });
      }
    };
    sources.forEach(visit);
    return [...skills];
  }

  private async getDefaultStatusId(workflowId: string): Promise<string | undefined> {
    const status = await this.prisma.taskStatus.findFirst({
      where: { workflowId },
      orderBy: [{ isDefault: 'desc' }, { position: 'asc' }],
      select: { id: true },
    });
    return status?.id;
  }

  private async ensureProjectMember(projectId: string, userId: string, createdBy: string) {
    await this.prisma.projectMember.upsert({
      where: { userId_projectId: { userId, projectId } },
      create: { userId, projectId, role: Role.MEMBER, createdBy, updatedBy: createdBy },
      update: {},
    });
  }

  private detectProvider(apiUrl: string): Provider {
    const lower = apiUrl.toLowerCase();
    if (lower.includes('generativelanguage.googleapis.com')) return 'google';
    if (lower.includes('anthropic.com')) return 'anthropic';
    if (lower.includes('openrouter.ai')) return 'openrouter';
    if (lower.includes('api.openai.com')) return 'openai';
    if (lower.includes('localhost') || lower.includes('127.0.0.1')) return 'ollama';
    return 'custom';
  }

  private appendAssignmentReason(description: string | undefined, reason: string): string {
    return [description, `Lý do phân công: ${reason}`].filter(Boolean).join('\n\n');
  }

  private toTaskPriority(value: unknown): TaskPriority {
    return Object.values(TaskPriority).includes(value as TaskPriority)
      ? (value as TaskPriority)
      : TaskPriority.MEDIUM;
  }

  private toOptionalNumber(value: unknown): number | undefined {
    const result = Number(value);
    return Number.isFinite(result) ? result : undefined;
  }

  private toOptionalInt(value: unknown): number | undefined {
    const result = this.toOptionalNumber(value);
    return result === undefined ? undefined : Math.max(1, Math.round(result));
  }

  private toEstimateMinutes(value: unknown): number | undefined {
    const hours = this.toOptionalNumber(value);
    return hours === undefined ? undefined : Math.max(15, Math.round(hours * 60));
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  }

  private firstRecord(value: unknown): Record<string, unknown> {
    return Array.isArray(value) ? this.asRecord(value[0]) : {};
  }

  private asOptionalString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
  }

  private asStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
  }

  private toRiskLevel(value: unknown): 'LOW' | 'MEDIUM' | 'HIGH' {
    return value === 'LOW' || value === 'MEDIUM' || value === 'HIGH' ? value : 'MEDIUM';
  }
}
