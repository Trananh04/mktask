import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ChatRequestDto } from './dto/chat.dto';
import { QueryPlan } from './query-planner.service';

export type AiChatIntent = 'AUTOMATION' | 'QUERY_DATA' | 'GUIDANCE';

export interface UserScope {
  role: 'MEMBER' | 'MANAGER' | 'OWNER' | 'SUPER_ADMIN';
  accessibleProjectIds: string[];
  userId: string;
  organizationId?: string;
  managedProjectIds: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  params: Record<string, any>;
}

/**
 * All non-automation messages go through QUERY_DATA so the QueryPlanner LLM
 * decides context (data query vs guidance) — no brittle regex pre-classification.
 */
export function classifyChatIntent(message: string, automationEnvelope = false): AiChatIntent {
  if (automationEnvelope) return 'AUTOMATION';
  return 'QUERY_DATA';
}

// ─── Helper: check if role is manager-level or above ─────────────────────────
function isManagerOrAbove(role: UserScope['role']): boolean {
  return role === 'MANAGER' || role === 'OWNER' || role === 'SUPER_ADMIN';
}
function isAdminOrOwner(role: UserScope['role']): boolean {
  return role === 'OWNER' || role === 'SUPER_ADMIN';
}

@Injectable()
export class AiDataToolsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Resolve User Scope ───────────────────────────────────────────────────
  async resolveUserScope(userId: string, organizationId?: string): Promise<UserScope> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    // Fallback: If no organizationId provided, try to find one for the user
    if (!organizationId) {
      const membership = await this.prisma.organizationMember.findFirst({
        where: { userId },
        select: { organizationId: true },
        orderBy: { joinedAt: 'asc' },
      });
      if (membership) {
        organizationId = membership.organizationId;
      } else {
        const ownedOrg = await this.prisma.organization.findFirst({
          where: { ownerId: userId },
          select: { id: true },
        });
        if (ownedOrg) {
          organizationId = ownedOrg.id;
        }
      }
    }

    const orgScope = organizationId ? { workspace: { organizationId } } : {};

    if (user?.role === Role.SUPER_ADMIN) {
      const projects = await this.prisma.project.findMany({
        where: { archive: false, ...orgScope },
        select: { id: true },
      });
      const ids = projects.map((p) => p.id);
      return {
        role: 'SUPER_ADMIN',
        accessibleProjectIds: ids,
        managedProjectIds: ids,
        userId,
        organizationId,
      };
    }

    let isOwner = false;
    if (organizationId) {
      const orgMember = await this.prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId, organizationId } },
        select: { role: true },
      });
      if (orgMember?.role === Role.OWNER) isOwner = true;
      const org = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { ownerId: true },
      });
      if (org?.ownerId === userId) isOwner = true;
    }

    if (isOwner) {
      const projects = await this.prisma.project.findMany({
        where: { archive: false, ...orgScope },
        select: { id: true },
      });
      const ids = projects.map((p) => p.id);
      return {
        role: 'OWNER',
        accessibleProjectIds: ids,
        managedProjectIds: ids,
        userId,
        organizationId,
      };
    }

    // Only look at explicit ProjectMember records — mirrors the new RolesGuard behavior.
    // Org-level or workspace-level MANAGER is NOT automatically a project manager.
    const projects = await this.prisma.project.findMany({
      where: {
        archive: false,
        ...orgScope,
        members: { some: { userId } }, // must be explicitly added to the project
      },
      select: {
        id: true,
        members: { where: { userId }, select: { role: true } },
      },
    });

    const accessibleProjectIds: string[] = [];
    const managedProjectIds: string[] = [];
    let hasManagerRole = false;

    for (const p of projects) {
      accessibleProjectIds.push(p.id);
      const memberRole = p.members[0]?.role;
      if (memberRole === Role.MANAGER || memberRole === Role.OWNER) {
        managedProjectIds.push(p.id);
        hasManagerRole = true;
      }
    }

    return {
      role: hasManagerRole ? 'MANAGER' : 'MEMBER',
      accessibleProjectIds,
      managedProjectIds,
      userId,
      organizationId,
    };
  }

  // ─── Build Tool Catalog based on role ────────────────────────────────────
  buildToolCatalog(userScope: UserScope): ToolDefinition[] {
    // ── MEMBER tools (available to all roles) ──
    const tools: ToolDefinition[] = [
      {
        name: 'get_my_tasks',
        description:
          'Get tasks assigned to the current logged-in user. Supports filtering by status, priority, project, overdue, sprint.',
        params: {
          projectSlug: 'string (optional)',
          statusCategory: 'string (optional) - TODO | IN_PROGRESS | DONE',
          priority: 'string (optional) - LOWEST | LOW | MEDIUM | HIGH | HIGHEST',
          isOverdue: 'boolean (optional)',
          hasNoDueDate: 'boolean (optional)',
          sprintName: 'string (optional)',
        },
      },
      {
        name: 'get_my_projects',
        description: 'Get the list of projects the current user belongs to.',
        params: {},
      },
      {
        name: 'get_project_health',
        description:
          'Get overall health, task counts, and completion rate for one or all accessible projects.',
        params: { projectSlug: 'string (optional)' },
      },
      {
        name: 'get_sprint_tasks',
        description: 'Get tasks in a sprint. If sprintName omitted, returns active sprint tasks.',
        params: {
          projectSlug: 'string (optional)',
          sprintName: 'string (optional)',
        },
      },
      {
        name: 'get_my_daily_reports',
        description: 'Get daily báo cáo (reports) submitted by the current user.',
        params: {
          reportDate: 'string (optional) - YYYY-MM-DD',
          status: 'string (optional) - SUBMITTED | REVIEWED',
        },
      },
      {
        name: 'get_my_time_entries',
        description: 'Get time tracking entries logged by the current user.',
        params: {
          projectSlug: 'string (optional)',
          fromDate: 'string (optional) - YYYY-MM-DD',
          toDate: 'string (optional) - YYYY-MM-DD',
        },
      },
      {
        name: 'get_my_notifications',
        description:
          'Get recent notifications for the current user. Includes task assignments, comments, mentions, and status changes.',
        params: {
          unreadOnly: 'boolean (optional) - if true, only return unread notifications',
          limit: 'number (optional) - max 20',
        },
      },
    ];

    // ── MANAGER tools (manager, owner, super_admin) ──
    if (isManagerOrAbove(userScope.role)) {
      tools.push(
        {
          name: 'get_tasks',
          description:
            'Get all tasks across accessible projects with rich filtering. Use for questions about any task in the team.',
          params: {
            projectSlug: 'string (optional)',
            sprintName: 'string (optional)',
            statusCategory: 'string (optional) - TODO | IN_PROGRESS | DONE',
            isOverdue: 'boolean (optional)',
            hasNoDueDate: 'boolean (optional)',
            isUnassigned: 'boolean (optional)',
            priority: 'string (optional) - LOWEST | LOW | MEDIUM | HIGH | HIGHEST',
            assigneeName: 'string (optional)',
          },
        },
        {
          name: 'get_workload',
          description:
            'Get task workload per team member. Useful for questions about who is overloaded or available.',
          params: {
            projectSlug: 'string (optional)',
            userName: 'string (optional)',
          },
        },
        {
          name: 'get_project_team',
          description: 'Get the list of members in one or all projects.',
          params: { projectSlug: 'string (optional)' },
        },
        {
          name: 'get_user_projects',
          description: 'Get the list of projects a specific user is participating in.',
          params: { userName: 'string (required)' },
        },
        {
          name: 'get_overdue_summary',
          description: 'Get overdue tasks grouped by assignee across managed projects.',
          params: { projectSlug: 'string (optional)' },
        },
        {
          name: 'get_daily_reports',
          description:
            'Get daily báo cáo (reports) from all team members. Filter by date, member, project, or status.',
          params: {
            reportDate: 'string (optional) - YYYY-MM-DD',
            reporterName: 'string (optional)',
            projectSlug: 'string (optional)',
            status: 'string (optional) - SUBMITTED | REVIEWED',
          },
        },
        {
          name: 'get_time_tracking',
          description:
            'Get time tracking summary for the team. Shows total hours logged per user or per project.',
          params: {
            projectSlug: 'string (optional)',
            userName: 'string (optional)',
            fromDate: 'string (optional) - YYYY-MM-DD',
            toDate: 'string (optional) - YYYY-MM-DD',
          },
        },
        {
          name: 'get_pending_status_requests',
          description: 'Get pending task status change requests waiting for manager review.',
          params: { projectSlug: 'string (optional)' },
        },
        {
          name: 'get_project_risks',
          description: 'Get risks registered for one or all managed projects.',
          params: {
            projectSlug: 'string (optional)',
            severity: 'string (optional) - LOW | MEDIUM | HIGH | CRITICAL',
            status: 'string (optional) - OPEN | MITIGATED | RESOLVED',
          },
        },
        {
          name: 'get_milestones',
          description: 'Get project milestones and their due dates/status.',
          params: {
            projectSlug: 'string (optional)',
            status: 'string (optional) - PLANNED | IN_PROGRESS | COMPLETED | MISSED',
          },
        },
        {
          name: 'get_sprint_summary',
          description:
            'Get a summary of all sprints for a project including task counts and progress.',
          params: { projectSlug: 'string (optional)' },
        },
        {
          name: 'get_blocked_tasks',
          description:
            'Get tasks that are currently blocked (isBlocked=true or have unresolved blocking dependencies) across managed projects.',
          params: {
            projectSlug: 'string (optional)',
          },
        },
        {
          name: 'find_member',
          description:
            'Search for a member by name or email in the organization or in accessible projects. Returns their basic info and project memberships.',
          params: {
            query: 'string (required) - name or email to search',
          },
        },
        {
          name: 'get_org_members',
          description: 'Get all members of the organization with their roles. Use this to list or search for members by name or email.',
          params: {
            role: 'string (optional) - MEMBER | MANAGER | OWNER',
            search: 'string (optional) - name or email search',
          },
        },
      );
    }

    // ── ADMIN/OWNER tools ──
    if (isAdminOrOwner(userScope.role)) {
      tools.push(
        {
          name: 'get_all_projects',
          description: 'Get all projects in the organization with health overview.',
          params: { includeArchived: 'boolean (optional)' },
        },
        {
          name: 'get_activity_log',
          description: 'Get recent activity logs across the organization.',
          params: {
            projectSlug: 'string (optional)',
            userName: 'string (optional)',
            fromDate: 'string (optional) - YYYY-MM-DD',
            limit: 'number (optional) - max 100',
          },
        },
        {
          name: 'get_project_status_updates',
          description: 'Get latest project status updates (health reports written by managers).',
          params: {
            projectSlug: 'string (optional)',
            health: 'string (optional) - ON_TRACK | AT_RISK | OFF_TRACK',
          },
        },
      );
    }

    return tools;
  }

  // ─── Context for QueryPlanner ─────────────────────────────────────────────
  async getAccessibleProjectsContext(userScope: UserScope): Promise<string> {
    const projects = await this.prisma.project.findMany({
      where: { id: { in: userScope.accessibleProjectIds } },
      select: { name: true, slug: true },
    });
    return JSON.stringify(projects);
  }

  // ─── Fallback grounded context if QueryPlanner fails ─────────────────────
  async buildGroundedContext(
    message: string,
    userId: string,
    request: ChatRequestDto,
  ): Promise<string> {
    const userScope = await this.resolveUserScope(userId, request.currentOrganizationId);
    if (userScope.accessibleProjectIds.length === 0) {
      return 'DATA TOOL RESULT: User has no accessible projects.';
    }
    const results = await this.executeTools(
      {
        tools: [
          { name: 'get_my_projects', params: {} },
          { name: 'get_project_health', params: {} },
        ],
        reasoning: 'Fallback',
      },
      userScope,
    );
    return `DATA TOOL RESULTS:\n${JSON.stringify(results, null, 2)}`;
  }

  // ─── Tool Execution Pipeline ──────────────────────────────────────────────
  async executeTools(plan: QueryPlan, userScope: UserScope): Promise<Record<string, any>> {
    const results: Record<string, any> = { _scope: userScope.role };

    if (userScope.accessibleProjectIds.length === 0) {
      return { error: 'No accessible projects in this organization.' };
    }

    for (const tool of plan.tools) {
      try {
        let res: any = null;
        switch (tool.name) {
          // ── MEMBER tools ──
          case 'get_my_tasks':
            res = await this.toolGetMyTasks(tool.params, userScope);
            break;
          case 'get_my_projects':
            res = await this.toolGetMyProjects(userScope);
            break;
          case 'get_project_health':
            res = await this.toolGetProjectHealth(tool.params, userScope);
            break;
          case 'get_sprint_tasks':
            res = await this.toolGetSprintTasks(tool.params, userScope);
            break;
          case 'get_my_daily_reports':
            res = await this.toolGetMyDailyReports(tool.params, userScope);
            break;
          case 'get_my_time_entries':
            res = await this.toolGetMyTimeEntries(tool.params, userScope);
            break;

          // ── MANAGER tools ──
          case 'get_tasks':
            res = isManagerOrAbove(userScope.role)
              ? await this.toolGetTasks(tool.params, userScope)
              : { error: 'Permission denied' };
            break;
          case 'get_workload':
            res = isManagerOrAbove(userScope.role)
              ? await this.toolGetWorkload(tool.params, userScope)
              : { error: 'Permission denied' };
            break;
          case 'get_project_team':
            res = isManagerOrAbove(userScope.role)
              ? await this.toolGetProjectTeam(tool.params, userScope)
              : { error: 'Permission denied' };
            break;
          case 'get_user_projects':
            res = isManagerOrAbove(userScope.role)
              ? await this.toolGetUserProjects(tool.params, userScope)
              : { error: 'Permission denied' };
            break;
          case 'get_overdue_summary':
            res = isManagerOrAbove(userScope.role)
              ? await this.toolGetOverdueSummary(tool.params, userScope)
              : { error: 'Permission denied' };
            break;
          case 'get_daily_reports':
            res = isManagerOrAbove(userScope.role)
              ? await this.toolGetDailyReports(tool.params, userScope)
              : { error: 'Permission denied. Use get_my_daily_reports instead.' };
            break;
          case 'get_time_tracking':
            res = isManagerOrAbove(userScope.role)
              ? await this.toolGetTimeTracking(tool.params, userScope)
              : { error: 'Permission denied' };
            break;
          case 'get_pending_status_requests':
            res = isManagerOrAbove(userScope.role)
              ? await this.toolGetPendingStatusRequests(tool.params, userScope)
              : { error: 'Permission denied' };
            break;
          case 'get_project_risks':
            res = isManagerOrAbove(userScope.role)
              ? await this.toolGetProjectRisks(tool.params, userScope)
              : { error: 'Permission denied' };
            break;
          case 'get_milestones':
            res = isManagerOrAbove(userScope.role)
              ? await this.toolGetMilestones(tool.params, userScope)
              : { error: 'Permission denied' };
            break;
          case 'get_sprint_summary':
            res = isManagerOrAbove(userScope.role)
              ? await this.toolGetSprintSummary(tool.params, userScope)
              : { error: 'Permission denied' };
            break;

          case 'get_org_members':
            res = (userScope.role === 'MANAGER' || isAdminOrOwner(userScope.role))
              ? await this.toolGetOrgMembers(tool.params, userScope)
              : { error: 'Permission denied' };
            break;
          case 'get_all_projects':
            res = isAdminOrOwner(userScope.role)
              ? await this.toolGetAllProjects(tool.params, userScope)
              : { error: 'Permission denied' };
            break;
          case 'get_activity_log':
            res = isAdminOrOwner(userScope.role)
              ? await this.toolGetActivityLog(tool.params, userScope)
              : { error: 'Permission denied' };
            break;
          case 'get_project_status_updates':
            res = isAdminOrOwner(userScope.role)
              ? await this.toolGetProjectStatusUpdates(tool.params, userScope)
              : { error: 'Permission denied' };
            break;

          case 'get_blocked_tasks':
            res = isManagerOrAbove(userScope.role)
              ? await this.toolGetBlockedTasks(tool.params, userScope)
              : { error: 'Permission denied' };
            break;
          case 'find_member':
            res = isManagerOrAbove(userScope.role)
              ? await this.toolFindMember(tool.params, userScope)
              : { error: 'Permission denied' };
            break;

          // ── MEMBER tools ──
          case 'get_my_notifications':
            res = await this.toolGetMyNotifications(tool.params, userScope);
            break;

          default:
            res = { error: `Unknown tool: ${tool.name}` };
        }
        results[tool.name] = res;
      } catch (e: any) {
        console.error(`Tool execution error [${tool.name}]:`, e);
        results[tool.name] = { error: e.message || 'Execution failed' };
      }
    }

    return results;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  private applyRoleConstraints(
    where: Prisma.TaskWhereInput,
    userScope: UserScope,
    projectId?: string,
  ) {
    if (userScope.role === 'MEMBER') {
      where.assignees = { some: { userId: userScope.userId } };
      where.projectId = { in: projectId ? [projectId] : userScope.accessibleProjectIds };
    } else if (userScope.role === 'MANAGER') {
      where.projectId = { in: projectId ? [projectId] : userScope.managedProjectIds };
    } else {
      where.projectId = { in: projectId ? [projectId] : userScope.accessibleProjectIds };
    }
  }

  private async resolveProjectId(
    projectSlug: string | undefined,
    userScope: UserScope,
  ): Promise<string | undefined> {
    if (!projectSlug) return undefined;
    const project = await this.prisma.project.findFirst({
      where: { slug: projectSlug, id: { in: userScope.accessibleProjectIds } },
      select: { id: true },
    });
    if (project) return project.id;
    const nameQuery = projectSlug.trim().toLowerCase();
    const candidates = await this.prisma.project.findMany({
      where: { id: { in: userScope.accessibleProjectIds } },
      select: { id: true, name: true, slug: true },
    });
    const match = candidates.find(
      (c) => c.name.toLowerCase().includes(nameQuery) || c.slug.toLowerCase().includes(nameQuery),
    );
    return match?.id;
  }

  private parseDateParam(dateStr: string | undefined): Date | undefined {
    if (!dateStr) return undefined;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? undefined : d;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MEMBER TOOLS
  // ─────────────────────────────────────────────────────────────────────────

  private async toolGetMyTasks(params: any, userScope: UserScope) {
    const projectId = await this.resolveProjectId(params.projectSlug, userScope);
    const where: Prisma.TaskWhereInput = {
      isArchived: false,
      assignees: { some: { userId: userScope.userId } },
      projectId: { in: projectId ? [projectId] : userScope.accessibleProjectIds },
    };
    if (params.statusCategory) where.status = { category: params.statusCategory };
    if (params.priority) where.priority = params.priority;
    if (params.isOverdue === true) {
      where.dueDate = { lt: new Date() };
      where.completedAt = null;
    }
    if (params.hasNoDueDate === true) {
      where.dueDate = null;
    }

    const tasks = await this.prisma.task.findMany({
      where,
      select: {
        title: true,
        priority: true,
        dueDate: true,
        progressPercent: true,
        status: { select: { name: true, category: true } },
        project: { select: { name: true } },
        sprint: { select: { name: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 50,
    });
    return { total: tasks.length, tasks };
  }

  private async toolGetMyProjects(userScope: UserScope) {
    const projects = await this.prisma.project.findMany({
      where: { id: { in: userScope.accessibleProjectIds } },
      select: { name: true, slug: true, description: true },
    });
    return { projects };
  }

  private async toolGetMyDailyReports(params: any, userScope: UserScope) {
    const where: any = {
      reporterId: userScope.userId,
      task: { projectId: { in: userScope.accessibleProjectIds } },
    };
    if (params.reportDate) {
      const date = this.parseDateParam(params.reportDate);
      if (date) {
        const next = new Date(date);
        next.setDate(next.getDate() + 1);
        where.reportDate = { gte: date, lt: next };
      }
    }
    if (params.status) where.status = params.status.toUpperCase();
    const reports = await this.prisma.taskDailyReport.findMany({
      where,
      select: {
        reportDate: true,
        type: true,
        content: true,
        blockers: true,
        progressPercent: true,
        status: true,
        task: { select: { title: true, project: { select: { name: true } } } },
      },
      orderBy: { reportDate: 'desc' },
      take: 50,
    });
    return { total: reports.length, reports };
  }

  private async toolGetMyTimeEntries(params: any, userScope: UserScope) {
    const projectId = await this.resolveProjectId(params.projectSlug, userScope);
    const where: any = {
      userId: userScope.userId,
      task: { projectId: { in: projectId ? [projectId] : userScope.accessibleProjectIds } },
    };
    if (params.fromDate) where.date = { ...where.date, gte: this.parseDateParam(params.fromDate) };
    if (params.toDate) where.date = { ...where.date, lte: this.parseDateParam(params.toDate) };
    const entries = await this.prisma.timeEntry.findMany({
      where,
      select: {
        date: true,
        timeSpent: true,
        description: true,
        task: { select: { title: true, project: { select: { name: true } } } },
      },
      orderBy: { date: 'desc' },
      take: 100,
    });
    const totalMinutes = entries.reduce((s, e) => s + e.timeSpent, 0);
    return { totalMinutes, totalHours: +(totalMinutes / 60).toFixed(1), entries };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MANAGER TOOLS
  // ─────────────────────────────────────────────────────────────────────────

  private async toolGetTasks(params: any, userScope: UserScope) {
    const projectId = await this.resolveProjectId(params.projectSlug, userScope);
    const where: Prisma.TaskWhereInput = { isArchived: false };
    this.applyRoleConstraints(where, userScope, projectId);
    if (params.statusCategory) where.status = { category: params.statusCategory };
    if (params.priority) where.priority = params.priority;
    if (params.isOverdue === true) {
      where.dueDate = { lt: new Date() };
      where.completedAt = null;
    }
    if (params.hasNoDueDate === true) {
      where.dueDate = null;
    }
    if (params.isUnassigned === true) where.assignees = { none: {} };
    if (params.assigneeName) {
      const q = params.assigneeName.toLowerCase();
      where.assignees = {
        some: {
          user: {
            OR: [
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
      };
    }
    const tasks = await this.prisma.task.findMany({
      where,
      select: {
        title: true,
        priority: true,
        dueDate: true,
        progressPercent: true,
        status: { select: { name: true, category: true } },
        project: { select: { name: true } },
        assignees: { select: { user: { select: { firstName: true, lastName: true } } } },
        sprint: { select: { name: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 80,
    });
    return { total: tasks.length, tasks };
  }

  private async toolGetProjectHealth(params: any, userScope: UserScope) {
    const projectId = await this.resolveProjectId(params.projectSlug, userScope);
    const ids = projectId ? [projectId] : userScope.accessibleProjectIds;
    const projects = await this.prisma.project.findMany({
      where: { id: { in: ids } },
      select: {
        name: true,
        slug: true,
        tasks: {
          where: { isArchived: false },
          select: { status: { select: { category: true } }, dueDate: true, completedAt: true },
        },
      },
    });
    return projects.map((p) => {
      const total = p.tasks.length;
      const done = p.tasks.filter((t) => t.status.category === 'DONE').length;
      const overdue = p.tasks.filter(
        (t) => t.dueDate && t.dueDate < new Date() && !t.completedAt,
      ).length;
      return {
        project: p.name,
        slug: p.slug,
        totalTasks: total,
        doneTasks: done,
        completionRate: total > 0 ? Math.round((done / total) * 100) : 0,
        overdueTasks: overdue,
      };
    });
  }

  private async toolGetSprintTasks(params: any, userScope: UserScope) {
    const projectId = await this.resolveProjectId(params.projectSlug, userScope);
    const sprintWhere: Prisma.SprintWhereInput = {};
    if (projectId) sprintWhere.projectId = projectId;
    else sprintWhere.projectId = { in: userScope.accessibleProjectIds };
    if (params.sprintName) sprintWhere.name = { contains: params.sprintName, mode: 'insensitive' };
    else sprintWhere.status = 'ACTIVE';
    const sprint = await this.prisma.sprint.findFirst({ where: sprintWhere });
    if (!sprint) return { error: 'Sprint not found' };
    const where: Prisma.TaskWhereInput = { sprintId: sprint.id, isArchived: false };
    this.applyRoleConstraints(where, userScope, sprint.projectId);
    const tasks = await this.prisma.task.findMany({
      where,
      select: {
        title: true,
        status: { select: { category: true, name: true } },
        assignees: { select: { user: { select: { firstName: true, lastName: true } } } },
        priority: true,
        dueDate: true,
      },
    });
    return {
      sprintName: sprint.name,
      status: sprint.status,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      totalTasks: tasks.length,
      tasks,
    };
  }

  private async toolGetWorkload(params: any, userScope: UserScope) {
    const projectId = await this.resolveProjectId(params.projectSlug, userScope);
    const ids = projectId ? [projectId] : userScope.managedProjectIds;
    const assignees = await this.prisma.taskAssignee.findMany({
      where: {
        task: { projectId: { in: ids }, isArchived: false, status: { category: { not: 'DONE' } } },
      },
      select: {
        user: { select: { firstName: true, lastName: true, email: true } },
        task: { select: { priority: true, dueDate: true } },
      },
    });
    const map = new Map<string, any>();
    for (const a of assignees) {
      const key = a.user.email;
      if (!map.has(key))
        map.set(key, {
          name: `${a.user.firstName || ''} ${a.user.lastName || ''}`.trim() || a.user.email,
          email: a.user.email,
          taskCount: 0,
          overdueTasks: 0,
        });
      const u = map.get(key);
      u.taskCount++;
      if (a.task.dueDate && a.task.dueDate < new Date()) u.overdueTasks++;
    }
    if (params.userName) {
      const q = params.userName.toLowerCase();
      return Array.from(map.values()).filter(
        (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
      );
    }
    return Array.from(map.values()).sort((a, b) => b.taskCount - a.taskCount);
  }

  private async toolGetProjectTeam(params: any, userScope: UserScope) {
    const projectId = await this.resolveProjectId(params.projectSlug, userScope);
    const ids = projectId ? [projectId] : userScope.accessibleProjectIds;
    const members = await this.prisma.projectMember.findMany({
      where: { projectId: { in: ids } },
      select: {
        role: true,
        project: { select: { name: true } },
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    });
    if (params.userName) {
      const q = params.userName.toLowerCase();
      return members.filter(
        (m) =>
          (m.user.firstName && m.user.firstName.toLowerCase().includes(q)) ||
          (m.user.lastName && m.user.lastName.toLowerCase().includes(q)) ||
          m.user.email.toLowerCase().includes(q),
      );
    }
    return members;
  }

  private async toolGetUserProjects(params: any, userScope: UserScope) {
    if (!params.userName) return { error: 'userName parameter is required' };
    const q = params.userName.toLowerCase().trim();
    const parts = q.split(/\s+/).filter((p: string) => p.length > 0);

    // Build flexible name search conditions that handle multi-word names like "his his"
    const nameOrConditions: any[] = [
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ];
    if (parts.length > 1) {
      // Match first word -> firstName and last word -> lastName (e.g. "his his" -> firstName:his AND lastName:his)
      nameOrConditions.push({
        AND: [
          { firstName: { contains: parts[0], mode: 'insensitive' } },
          { lastName: { contains: parts[parts.length - 1], mode: 'insensitive' } },
        ],
      });
    }

    // First: search all users in the organization matching the name/email
    const userWhere: any = { OR: nameOrConditions };
    if (userScope.organizationId) {
      userWhere.organizationMembers = { some: { organizationId: userScope.organizationId } };
    }
    const matchedUsers = await this.prisma.user.findMany({
      where: userWhere,
      select: { id: true, firstName: true, lastName: true, email: true },
      take: 10,
    });

    if (matchedUsers.length === 0) return [];

    // Find project memberships for those users, scoped to projects the current user can see
    const members = await this.prisma.projectMember.findMany({
      where: {
        userId: { in: matchedUsers.map((u) => u.id) },
        projectId: { in: userScope.accessibleProjectIds },
      },
      select: {
        role: true,
        project: { select: { name: true, slug: true } },
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    const userMap = new Map<string, any>();
    for (const m of members) {
      const key = m.user.email;
      if (!userMap.has(key))
        userMap.set(key, {
          name: `${m.user.firstName || ''} ${m.user.lastName || ''}`.trim() || m.user.email,
          email: m.user.email,
          projects: [],
        });
      userMap.get(key).projects.push({ name: m.project.name, slug: m.project.slug, role: m.role });
    }

    // Include users found but with no visible project memberships
    for (const u of matchedUsers) {
      if (!userMap.has(u.email)) {
        userMap.set(u.email, {
          name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
          email: u.email,
          projects: [],
        });
      }
    }

    return Array.from(userMap.values());
  }

  private async toolGetOverdueSummary(params: any, userScope: UserScope) {
    const projectId = await this.resolveProjectId(params.projectSlug, userScope);
    const ids = projectId ? [projectId] : userScope.managedProjectIds;
    const tasks = await this.prisma.task.findMany({
      where: {
        projectId: { in: ids },
        isArchived: false,
        completedAt: null,
        dueDate: { lt: new Date() },
      },
      select: {
        title: true,
        dueDate: true,
        priority: true,
        project: { select: { name: true } },
        assignees: {
          select: { user: { select: { firstName: true, lastName: true, email: true } } },
        },
      },
      orderBy: { dueDate: 'asc' },
    });
    return { total: tasks.length, tasks };
  }

  private async toolGetDailyReports(params: any, userScope: UserScope) {
    const projectId = await this.resolveProjectId(params.projectSlug, userScope);
    const ids = projectId ? [projectId] : userScope.managedProjectIds;
    const where: any = { task: { projectId: { in: ids } } };
    if (params.reportDate) {
      const date = this.parseDateParam(params.reportDate);
      if (date) {
        const next = new Date(date);
        next.setDate(next.getDate() + 1);
        where.reportDate = { gte: date, lt: next };
      }
    }
    if (params.status) where.status = params.status.toUpperCase();
    const reports = await this.prisma.taskDailyReport.findMany({
      where,
      select: {
        reportDate: true,
        type: true,
        content: true,
        blockers: true,
        progressPercent: true,
        status: true,
        reporter: { select: { firstName: true, lastName: true, email: true } },
        task: { select: { title: true, project: { select: { name: true } } } },
      },
      orderBy: { reportDate: 'desc' },
      take: 100,
    });
    const filtered = params.reporterName
      ? reports.filter((r) => {
          const q = params.reporterName.toLowerCase();
          return (
            (r.reporter.firstName && r.reporter.firstName.toLowerCase().includes(q)) ||
            (r.reporter.lastName && r.reporter.lastName.toLowerCase().includes(q)) ||
            r.reporter.email.toLowerCase().includes(q)
          );
        })
      : reports;
    return { total: filtered.length, reports: filtered };
  }

  private async toolGetTimeTracking(params: any, userScope: UserScope) {
    const projectId = await this.resolveProjectId(params.projectSlug, userScope);
    const ids = projectId ? [projectId] : userScope.managedProjectIds;
    const where: any = { task: { projectId: { in: ids } } };
    if (params.fromDate) where.date = { ...where.date, gte: this.parseDateParam(params.fromDate) };
    if (params.toDate) where.date = { ...where.date, lte: this.parseDateParam(params.toDate) };
    const entries = await this.prisma.timeEntry.findMany({
      where,
      select: {
        date: true,
        timeSpent: true,
        user: { select: { firstName: true, lastName: true, email: true } },
        task: { select: { title: true, project: { select: { name: true } } } },
      },
      orderBy: { date: 'desc' },
      take: 200,
    });
    const userMap = new Map<string, any>();
    for (const e of entries) {
      if (params.userName) {
        const q = params.userName.toLowerCase();
        const match =
          (e.user.firstName && e.user.firstName.toLowerCase().includes(q)) ||
          (e.user.lastName && e.user.lastName.toLowerCase().includes(q)) ||
          e.user.email.toLowerCase().includes(q);
        if (!match) continue;
      }
      const key = e.user.email;
      if (!userMap.has(key))
        userMap.set(key, {
          name: `${e.user.firstName || ''} ${e.user.lastName || ''}`.trim() || e.user.email,
          email: e.user.email,
          totalMinutes: 0,
        });
      userMap.get(key).totalMinutes += e.timeSpent;
    }
    return Array.from(userMap.values()).map((u) => ({
      ...u,
      totalHours: +(u.totalMinutes / 60).toFixed(1),
    }));
  }

  private async toolGetPendingStatusRequests(params: any, userScope: UserScope) {
    const projectId = await this.resolveProjectId(params.projectSlug, userScope);
    const ids = projectId ? [projectId] : userScope.managedProjectIds;
    const requests = await this.prisma.taskStatusChangeRequest.findMany({
      where: { status: 'PENDING', task: { projectId: { in: ids } } },
      select: {
        createdAt: true,
        requesterNote: true,
        task: { select: { title: true, project: { select: { name: true } } } },
        requestedBy: { select: { firstName: true, lastName: true, email: true } },
        requestedStatus: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return { total: requests.length, requests };
  }

  private async toolGetProjectRisks(params: any, userScope: UserScope) {
    const projectId = await this.resolveProjectId(params.projectSlug, userScope);
    const ids = projectId ? [projectId] : userScope.managedProjectIds;
    const where: any = { projectId: { in: ids } };
    if (params.severity) where.severity = params.severity.toUpperCase();
    if (params.status) where.status = params.status.toUpperCase();
    const risks = await this.prisma.projectRisk.findMany({
      where,
      select: {
        title: true,
        description: true,
        severity: true,
        status: true,
        mitigation: true,
        project: { select: { name: true } },
      },
      orderBy: [{ severity: 'desc' }, { status: 'asc' }],
    });
    return { total: risks.length, risks };
  }

  private async toolGetMilestones(params: any, userScope: UserScope) {
    const projectId = await this.resolveProjectId(params.projectSlug, userScope);
    const ids = projectId ? [projectId] : userScope.managedProjectIds;
    const where: any = { projectId: { in: ids } };
    if (params.status) where.status = params.status.toUpperCase();
    const milestones = await this.prisma.projectMilestone.findMany({
      where,
      select: {
        name: true,
        description: true,
        dueDate: true,
        status: true,
        project: { select: { name: true } },
      },
      orderBy: { dueDate: 'asc' },
    });
    return { total: milestones.length, milestones };
  }

  private async toolGetSprintSummary(params: any, userScope: UserScope) {
    const projectId = await this.resolveProjectId(params.projectSlug, userScope);
    const ids = projectId ? [projectId] : userScope.managedProjectIds;
    const sprints = await this.prisma.sprint.findMany({
      where: { projectId: { in: ids }, archive: false },
      select: {
        name: true,
        status: true,
        startDate: true,
        endDate: true,
        project: { select: { name: true } },
        tasks: { where: { isArchived: false }, select: { status: { select: { category: true } } } },
      },
      orderBy: { startDate: 'desc' },
    });
    return sprints.map((s) => {
      const total = s.tasks.length;
      const done = s.tasks.filter((t) => t.status.category === 'DONE').length;
      return {
        project: s.project.name,
        sprint: s.name,
        status: s.status,
        startDate: s.startDate,
        endDate: s.endDate,
        totalTasks: total,
        doneTasks: done,
        completionRate: total > 0 ? Math.round((done / total) * 100) : 0,
      };
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ADMIN / OWNER TOOLS
  // ─────────────────────────────────────────────────────────────────────────

  private async toolGetOrgMembers(params: any, userScope: UserScope) {
    if (!userScope.organizationId) return { error: 'No organization context' };
    const where: any = { organizationId: userScope.organizationId };
    if (params.role) where.role = params.role.toUpperCase();
    const members = await this.prisma.organizationMember.findMany({
      where,
      select: {
        role: true,
        joinedAt: true,
        user: { select: { firstName: true, lastName: true, email: true, status: true } },
      },
      orderBy: { user: { firstName: 'asc' } },
    });
    const filtered = params.search
      ? members.filter((m) => {
          const q = params.search.toLowerCase();
          return (
            (m.user.firstName && m.user.firstName.toLowerCase().includes(q)) ||
            (m.user.lastName && m.user.lastName.toLowerCase().includes(q)) ||
            m.user.email.toLowerCase().includes(q)
          );
        })
      : members;
    return { total: filtered.length, members: filtered };
  }

  private async toolGetAllProjects(params: any, userScope: UserScope) {
    const where: Prisma.ProjectWhereInput = {};
    if (!params.includeArchived) where.archive = false;
    if (userScope.organizationId) where.workspace = { organizationId: userScope.organizationId };
    const projects = await this.prisma.project.findMany({
      where,
      select: {
        name: true,
        slug: true,
        description: true,
        archive: true,
        tasks: {
          where: { isArchived: false },
          select: { status: { select: { category: true } }, dueDate: true, completedAt: true },
        },
        members: { select: { user: { select: { firstName: true, lastName: true } } } },
        workspace: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return projects.map((p) => {
      const total = p.tasks.length;
      const done = p.tasks.filter((t) => t.status.category === 'DONE').length;
      const overdue = p.tasks.filter(
        (t) => t.dueDate && t.dueDate < new Date() && !t.completedAt,
      ).length;
      return {
        name: p.name,
        slug: p.slug,
        workspace: p.workspace.name,
        archived: p.archive,
        memberCount: p.members.length,
        totalTasks: total,
        doneTasks: done,
        completionRate: total > 0 ? Math.round((done / total) * 100) : 0,
        overdueTasks: overdue,
      };
    });
  }

  private async toolGetActivityLog(params: any, userScope: UserScope) {
    const where: any = {};
    if (userScope.organizationId) where.organizationId = userScope.organizationId;
    if (params.fromDate)
      where.createdAt = { ...where.createdAt, gte: this.parseDateParam(params.fromDate) };
    if (params.userName) {
      const q = params.userName.toLowerCase();
      where.user = {
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      };
    }
    const limit = Math.min(params.limit || 50, 100);
    const logs = await this.prisma.activityLog.findMany({
      where,
      select: {
        type: true,
        description: true,
        entityType: true,
        createdAt: true,
        user: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return { total: logs.length, logs };
  }

  private async toolGetProjectStatusUpdates(params: any, userScope: UserScope) {
    const projectId = await this.resolveProjectId(params.projectSlug, userScope);
    const ids = projectId ? [projectId] : userScope.accessibleProjectIds;
    const where: any = { projectId: { in: ids } };
    if (params.health) where.health = params.health.toUpperCase();
    const updates = await this.prisma.projectStatusUpdate.findMany({
      where,
      select: {
        health: true,
        summary: true,
        nextSteps: true,
        createdAt: true,
        project: { select: { name: true } },
        author: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return { total: updates.length, updates };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NEW TOOLS: get_my_notifications, get_blocked_tasks, find_member
  // ─────────────────────────────────────────────────────────────────────────

  private async toolGetMyNotifications(params: any, userScope: UserScope) {
    const limit = Math.min(params.limit || 15, 20);
    const where: any = { userId: userScope.userId };
    if (params.unreadOnly === true) where.isRead = false;
    const notifications = await this.prisma.notification.findMany({
      where,
      select: {
        type: true,
        title: true,
        message: true,
        readAt: true,
        createdAt: true,
        isRead: true,
        entityType: true,
        entityId: true,
        actionUrl: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    const unreadCount = notifications.filter((n) => !n.isRead).length;
    return { total: notifications.length, unreadCount, notifications };
  }

  private async toolGetBlockedTasks(params: any, userScope: UserScope) {
    const projectId = await this.resolveProjectId(params.projectSlug, userScope);
    const ids = projectId ? [projectId] : userScope.managedProjectIds;
    const tasks = await this.prisma.task.findMany({
      where: {
        isArchived: false,
        projectId: { in: ids },
        completedAt: null,
        OR: [{ isBlocked: true }, { dependsOn: { some: { blockingTask: { completedAt: null } } } }],
      },
      select: {
        title: true,
        priority: true,
        dueDate: true,
        isBlocked: true,
        blockedReason: true,
        status: { select: { name: true, category: true } },
        project: { select: { name: true } },
        assignees: { select: { user: { select: { firstName: true, lastName: true } } } },
        dependsOn: {
          where: { blockingTask: { completedAt: null } },
          select: {
            type: true,
            blockingTask: { select: { title: true } },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
      take: 50,
    });
    return { total: tasks.length, tasks };
  }

  private async toolFindMember(params: any, userScope: UserScope) {
    if (!params.query) return { error: 'query parameter is required' };
    const q = params.query.toLowerCase().trim();
    const parts = q.split(/\s+/).filter((p: string) => p.length > 0);

    // Build flexible name search that handles multi-word queries like "his his"
    const nameOrConditions: any[] = [
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ];
    if (parts.length > 1) {
      nameOrConditions.push({
        AND: [
          { firstName: { contains: parts[0], mode: 'insensitive' } },
          { lastName: { contains: parts[parts.length - 1], mode: 'insensitive' } },
        ],
      });
    }

    const where: any = { OR: nameOrConditions };
    // Scope to organization if available
    if (userScope.organizationId) {
      where.organizationMembers = { some: { organizationId: userScope.organizationId } };
    }
    const users = await this.prisma.user.findMany({
      where,
      select: {
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        projectMembers: {
          // Use accessibleProjectIds so we return ALL projects the querying user can see,
          // not just managed ones — fixes false "no projects" answers for member-role users.
          where: { projectId: { in: userScope.accessibleProjectIds } },
          select: {
            role: true,
            project: { select: { name: true, slug: true } },
          },
        },
      },
      take: 10,
    });
    return {
      total: users.length,
      members: users.map((u) => ({
        name: `${u.firstName} ${u.lastName}`.trim(),
        email: u.email,
        systemRole: u.role,
        projectMemberships: u.projectMembers.map((pm) => ({
          project: pm.project.name,
          projectSlug: pm.project.slug,
          role: pm.role,
        })),
      })),
    };
  }
}
