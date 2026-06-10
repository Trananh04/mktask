import { Injectable } from '@nestjs/common';
import { Prisma, Role, StatusCategory, TaskPriority, TaskStatus, User } from '@prisma/client';
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

const QUERY_DATA_PATTERNS = [
  /\bbao nhi[eê]u\b/i, /\bli[eệ]t k[eê]\b/i, /\bti[eế]n [đd][oộ]\b/i,
  /\bxong ch[uư]a\b/i, /\bt[iì]nh h[iì]nh\b/i, /\br[uủ]i ro\b/i,
  /\bqu[aá] h[aạ]n\b/i, /\boverdue\b/i, /\bworkload\b/i,
  /\bqu[aá] t[aả]i\b/i, /\b[đd]ang r[aả]nh\b/i, /\bavailable assignee/i,
  /\bdaily report\b/i, /\bb[aá]o c[aá]o\b/i, /\bho[aà]n th[aà]nh\b/i,
  /\bl[aà]m xong\b/i, /\bcompleted\b/i, /\bdeadline\b/i,
  /\btime tracking\b/i, /\bgi[oờ] l[aà]m\b/i, /\bt[aạ]i sao\b/i,
  /\bwhy\b/i, /\bt[oó]m t[aắ]t\b/i, /\bsummar/i, /\bai (?:đang|l[aà])\b/i,
  /\bbao l[aâ]u\b/i, /\bl[aà]m t[oố]t nh[aấ]t\b/i,
];

const GUIDANCE_PATTERNS = [
  /\bl[aà]m sao\b/i, /\bh[uư][oớ]ng d[aẫ]n\b/i, /\bc[aá]ch (?:n[aà]o|[đd][eể])\b/i, /\bg[oợ]i [yý]\b/i
];

export function classifyChatIntent(message: string, automationEnvelope = false): AiChatIntent {
  if (automationEnvelope) return 'AUTOMATION';
  if (GUIDANCE_PATTERNS.some((pattern) => pattern.test(message))) return 'GUIDANCE';
  
  // Default to QUERY_DATA so the powerful Query Planner LLM can analyze complex questions
  return 'QUERY_DATA';
}

@Injectable()
export class AiDataToolsService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveUserScope(userId: string, organizationId?: string): Promise<UserScope> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    const orgScope = organizationId ? { workspace: { organizationId } } : {};
    
    if (user?.role === Role.SUPER_ADMIN) {
      const projects = await this.prisma.project.findMany({ where: { archive: false, ...orgScope }, select: { id: true } });
      const ids = projects.map(p => p.id);
      return { role: 'SUPER_ADMIN', accessibleProjectIds: ids, managedProjectIds: ids, userId, organizationId };
    }

    let isOwner = false;
    if (organizationId) {
      const orgMember = await this.prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId, organizationId } },
        select: { role: true }
      });
      if (orgMember?.role === Role.OWNER) isOwner = true;
      const org = await this.prisma.organization.findUnique({ where: { id: organizationId }, select: { ownerId: true } });
      if (org?.ownerId === userId) isOwner = true;
    }

    if (isOwner) {
      const projects = await this.prisma.project.findMany({ where: { archive: false, ...orgScope }, select: { id: true } });
      const ids = projects.map(p => p.id);
      return { role: 'OWNER', accessibleProjectIds: ids, managedProjectIds: ids, userId, organizationId };
    }

    // Manager / Member logic
    const projects = await this.prisma.project.findMany({
      where: {
        archive: false,
        ...orgScope,
        OR: [
          { members: { some: { userId } } },
          { workspace: { members: { some: { userId } } } }
        ]
      },
      select: { 
        id: true, 
        members: { where: { userId }, select: { role: true } },
        workspace: { select: { members: { where: { userId }, select: { role: true } } } }
      }
    });

    const accessibleProjectIds: string[] = [];
    const managedProjectIds: string[] = [];
    let hasManagerRole = false;

    for (const p of projects) {
      accessibleProjectIds.push(p.id);
      const isProjManager = p.members[0]?.role === Role.MANAGER || p.members[0]?.role === Role.OWNER;
      const isWsManager = p.workspace.members[0]?.role === Role.MANAGER || p.workspace.members[0]?.role === Role.OWNER;
      
      if (isProjManager || isWsManager) {
        managedProjectIds.push(p.id);
        hasManagerRole = true;
      }
    }

    return {
      role: hasManagerRole ? 'MANAGER' : 'MEMBER',
      accessibleProjectIds,
      managedProjectIds,
      userId,
      organizationId
    };
  }

  buildToolCatalog(userScope: UserScope): ToolDefinition[] {
    const tools: ToolDefinition[] = [
      {
        name: 'get_tasks',
        description: 'Get a list of tasks matching specific filters.',
        params: {
          projectSlug: 'string (optional) - Filter by project slug',
          sprintName: 'string (optional) - Filter by sprint name',
          statusCategory: 'string (optional) - TODO, IN_PROGRESS, DONE',
          isOverdue: 'boolean (optional) - Only overdue tasks',
          isUnassigned: 'boolean (optional) - Only unassigned tasks',
          priority: 'string (optional) - LOWEST, LOW, MEDIUM, HIGH, HIGHEST',
        }
      },
      {
        name: 'get_project_health',
        description: 'Get project overall health, task counts, completion rate.',
        params: {
          projectSlug: 'string (optional) - The project slug. If omitted, gets overall health.'
        }
      },
      {
        name: 'get_workload',
        description: 'Get task workload for specific users or find available assignees.',
        params: {
          projectSlug: 'string (optional)',
          userName: 'string (optional) - Filter by specific user name'
        }
      },
      {
        name: 'get_sprint_tasks',
        description: 'Get tasks for a specific sprint.',
        params: {
          projectSlug: 'string (optional)',
          sprintName: 'string (optional) - If omitted, gets active sprint'
        }
      }
    ];

    if (userScope.role !== 'MEMBER') {
      tools.push({
        name: 'get_project_team',
        description: 'Get the list of members in a project.',
        params: { projectSlug: 'string (optional)' }
      });
      tools.push({
        name: 'get_user_projects',
        description: 'Get the list of projects a specific user is participating in.',
        params: { userName: 'string (required) - The name or email of the user' }
      });
      tools.push({
        name: 'get_overdue_summary',
        description: 'Get summary of overdue tasks grouped by assignee.',
        params: { projectSlug: 'string (optional)' }
      });
      tools.push({
        name: 'get_time_tracking',
        description: 'Get time tracking stats.',
        params: { projectSlug: 'string (optional)' }
      });
    }

    return tools;
  }

  async getAccessibleProjectsContext(userScope: UserScope): Promise<string> {
    const projects = await this.prisma.project.findMany({
      where: { id: { in: userScope.accessibleProjectIds } },
      select: { name: true, slug: true }
    });
    return JSON.stringify(projects);
  }

  // --- Fallback grounded context if LLM #1 fails ---
  async buildGroundedContext(message: string, userId: string, request: ChatRequestDto): Promise<string> {
    // Keep a simple fallback if QueryPlanner fails completely
    const userScope = await this.resolveUserScope(userId, request.currentOrganizationId);
    if (userScope.accessibleProjectIds.length === 0) {
      return 'DATA TOOL RESULT: User has no accessible projects.';
    }
    const results = await this.executeTools({ tools: [{ name: 'get_project_health', params: {} }], reasoning: 'Fallback' }, userScope);
    return `DATA TOOL RESULTS:\n${JSON.stringify(results, null, 2)}`;
  }

  // --- Tool Execution Pipeline ---
  async executeTools(plan: QueryPlan, userScope: UserScope): Promise<Record<string, any>> {
    const results: Record<string, any> = { _scope: userScope.role };
    
    if (userScope.accessibleProjectIds.length === 0) {
      return { error: 'No accessible projects in this organization.' };
    }

    for (const tool of plan.tools) {
      try {
        let res: any = null;
        switch (tool.name) {
          case 'get_tasks':
            res = await this.toolGetTasks(tool.params, userScope);
            break;
          case 'get_project_health':
            res = await this.toolGetProjectHealth(tool.params, userScope);
            break;
          case 'get_workload':
            res = await this.toolGetWorkload(tool.params, userScope);
            break;
          case 'get_sprint_tasks':
            res = await this.toolGetSprintTasks(tool.params, userScope);
            break;
          case 'get_project_team':
            if (userScope.role !== 'MEMBER') res = await this.toolGetProjectTeam(tool.params, userScope);
            else res = { error: 'Permission denied for tool get_project_team' };
            break;
          case 'get_user_projects':
            if (userScope.role !== 'MEMBER') res = await this.toolGetUserProjects(tool.params, userScope);
            else res = { error: 'Permission denied' };
            break;
          case 'get_overdue_summary':
            if (userScope.role !== 'MEMBER') res = await this.toolGetOverdueSummary(tool.params, userScope);
            else res = { error: 'Permission denied' };
            break;
          case 'get_time_tracking':
             if (userScope.role !== 'MEMBER') res = await this.toolGetTimeTracking(tool.params, userScope);
             else res = { error: 'Permission denied' };
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

  // --- Helper to apply role constraints ---
  private applyRoleConstraints(where: Prisma.TaskWhereInput, userScope: UserScope, projectId?: string) {
    if (userScope.role === 'MEMBER') {
      where.assignees = { some: { userId: userScope.userId } };
      where.projectId = { in: projectId ? [projectId] : userScope.accessibleProjectIds };
    } else if (userScope.role === 'MANAGER') {
      where.projectId = { in: projectId ? [projectId] : userScope.managedProjectIds };
    } else {
      where.projectId = { in: projectId ? [projectId] : userScope.accessibleProjectIds };
    }
  }

  private async resolveProjectId(projectSlug: string | undefined, userScope: UserScope): Promise<string | undefined> {
    if (!projectSlug) return undefined;
    // Try exact slug match first
    let project = await this.prisma.project.findFirst({
      where: { slug: projectSlug, id: { in: userScope.accessibleProjectIds } },
      select: { id: true }
    });
    if (project) return project.id;
    // Fallback: search by name (case-insensitive) - useful when LLM passes a display name
    const nameQuery = projectSlug.trim().toLowerCase();
    const candidates = await this.prisma.project.findMany({
      where: { id: { in: userScope.accessibleProjectIds } },
      select: { id: true, name: true, slug: true }
    });
    const match = candidates.find(
      (p) => p.name.toLowerCase().includes(nameQuery) || p.slug.toLowerCase().includes(nameQuery) || nameQuery.includes(p.name.toLowerCase())
    );
    return match?.id;
  }

  // --- Tool Implementations ---
  
  private async toolGetTasks(params: any, userScope: UserScope) {
    const projectId = await this.resolveProjectId(params.projectSlug, userScope);
    if (params.projectSlug && !projectId) return { error: `Project ${params.projectSlug} not found or inaccessible` };

    const where: Prisma.TaskWhereInput = { isArchived: false };
    this.applyRoleConstraints(where, userScope, projectId);

    if (params.isOverdue) {
      where.dueDate = { lt: new Date() };
      where.completedAt = null;
    }
    if (params.isUnassigned) where.assignees = { none: {} };
    if (params.priority) where.priority = params.priority as TaskPriority;
    if (params.statusCategory) {
      where.status = { category: params.statusCategory as StatusCategory };
    }

    const tasks = await this.prisma.task.findMany({
      where,
      select: {
        title: true, priority: true, dueDate: true, completedAt: true,
        status: { select: { name: true, category: true } },
        project: { select: { name: true, slug: true } },
        assignees: { select: { user: { select: { firstName: true, lastName: true } } } }
      },
      orderBy: { dueDate: 'asc' },
      take: 30
    });
    return { count: tasks.length, tasks };
  }

  private async toolGetProjectHealth(params: any, userScope: UserScope) {
    const projectId = await this.resolveProjectId(params.projectSlug, userScope);
    const ids = projectId ? [projectId] : (userScope.role === 'MANAGER' ? userScope.managedProjectIds : userScope.accessibleProjectIds);
    
    if (ids.length === 0) return { error: 'No projects found' };

    const whereBase: any = { projectId: { in: ids }, isArchived: false };
    if (userScope.role === 'MEMBER') whereBase['assignees'] = { some: { userId: userScope.userId } };

    const now = new Date();
    const [total, completed, overdue, blocked] = await Promise.all([
      this.prisma.task.count({ where: whereBase }),
      this.prisma.task.count({ where: { ...whereBase, completedAt: { not: null } } }),
      this.prisma.task.count({ where: { ...whereBase, completedAt: null, dueDate: { lt: now } } }),
      this.prisma.task.count({ where: { ...whereBase, completedAt: null, isBlocked: true } })
    ]);

    return {
      totalTasks: total,
      completedTasks: completed,
      openTasks: total - completed,
      overdueTasks: overdue,
      blockedTasks: blocked,
      completionPercent: total === 0 ? 0 : Math.round((completed / total) * 100),
    };
  }

  private async toolGetWorkload(params: any, userScope: UserScope) {
    const projectId = await this.resolveProjectId(params.projectSlug, userScope);
    const ids = projectId ? [projectId] : userScope.accessibleProjectIds;
    
    const whereBase: any = { task: { projectId: { in: ids }, isArchived: false, completedAt: null } };
    
    if (userScope.role === 'MEMBER') {
       whereBase.userId = userScope.userId;
    } else if (params.userName) {
       whereBase.user = { 
         OR: [
           { firstName: { contains: params.userName, mode: 'insensitive' } },
           { lastName: { contains: params.userName, mode: 'insensitive' } }
         ]
       };
    }

    const counts = await this.prisma.taskAssignee.groupBy({
      by: ['userId'],
      where: whereBase,
      _count: true
    });

    const users = await this.prisma.user.findMany({
      where: { id: { in: counts.map(c => c.userId) } },
      select: { id: true, firstName: true, lastName: true }
    });

    return counts.map(c => {
      const u = users.find(x => x.id === c.userId);
      return { user: `${u?.firstName} ${u?.lastName}`, openTasks: c._count };
    });
  }

  private async toolGetSprintTasks(params: any, userScope: UserScope) {
    const projectId = await this.resolveProjectId(params.projectSlug, userScope);
    const sprintWhere: Prisma.SprintWhereInput = {};
    if (projectId) sprintWhere.projectId = projectId;
    else sprintWhere.projectId = { in: userScope.accessibleProjectIds };

    if (params.sprintName) {
      sprintWhere.name = { contains: params.sprintName, mode: 'insensitive' };
    } else {
      sprintWhere.status = 'ACTIVE';
    }

    const sprint = await this.prisma.sprint.findFirst({ where: sprintWhere });
    if (!sprint) return { error: 'Sprint not found' };

    const where: Prisma.TaskWhereInput = { sprintId: sprint.id, isArchived: false };
    this.applyRoleConstraints(where, userScope, sprint.projectId);

    const tasks = await this.prisma.task.findMany({
      where,
      select: { title: true, status: { select: { category: true, name: true } }, assignees: { select: { user: { select: { firstName: true } } } } }
    });

    return { sprintName: sprint.name, status: sprint.status, totalTasks: tasks.length, tasks };
  }

  private async toolGetProjectTeam(params: any, userScope: UserScope) {
    const projectId = await this.resolveProjectId(params.projectSlug, userScope);
    const ids = projectId ? [projectId] : userScope.accessibleProjectIds;

    const members = await this.prisma.projectMember.findMany({
      where: { projectId: { in: ids } },
      select: {
        role: true,
        project: { select: { name: true } },
        user: { select: { firstName: true, lastName: true, email: true } }
      }
    });

    if (params.userName) {
      const q = params.userName.toLowerCase();
      const filtered = members.filter(m => 
        (m.user.firstName && m.user.firstName.toLowerCase().includes(q)) ||
        (m.user.lastName && m.user.lastName.toLowerCase().includes(q)) ||
        m.user.email.toLowerCase().includes(q)
      );
      return filtered;
    }

    return members;
  }

  private async toolGetUserProjects(params: any, userScope: UserScope) {
    if (!params.userName) return { error: 'userName parameter is required' };
    
    const q = params.userName.toLowerCase();
    const members = await this.prisma.projectMember.findMany({
      where: { projectId: { in: userScope.accessibleProjectIds } },
      select: {
        role: true,
        project: { select: { name: true, slug: true } },
        user: { select: { firstName: true, lastName: true, email: true } }
      }
    });

    const filtered = members.filter(m => 
      (m.user.firstName && m.user.firstName.toLowerCase().includes(q)) ||
      (m.user.lastName && m.user.lastName.toLowerCase().includes(q)) ||
      m.user.email.toLowerCase().includes(q)
    );

    // Group by user
    const userMap = new Map();
    for (const m of filtered) {
      const key = m.user.email;
      if (!userMap.has(key)) {
        userMap.set(key, { 
          name: `${m.user.firstName || ''} ${m.user.lastName || ''}`.trim() || m.user.email,
          email: m.user.email,
          projects: [] 
        });
      }
      userMap.get(key).projects.push({ name: m.project.name, slug: m.project.slug, role: m.role });
    }

    return Array.from(userMap.values());
  }

  private async toolGetOverdueSummary(params: any, userScope: UserScope) {
     const projectId = await this.resolveProjectId(params.projectSlug, userScope);
     const ids = projectId ? [projectId] : userScope.managedProjectIds;
     const tasks = await this.prisma.task.findMany({
       where: { projectId: { in: ids }, isArchived: false, completedAt: null, dueDate: { lt: new Date() } },
       select: { title: true, dueDate: true, project: { select: { name: true } }, assignees: { select: { user: { select: { firstName: true, lastName: true } } } } }
     });
     return tasks;
  }

  private async toolGetTimeTracking(params: any, userScope: UserScope) {
     return { message: "Time tracking summary not fully implemented yet." };
  }
}
