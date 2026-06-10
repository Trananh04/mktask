import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessControlService } from 'src/common/access-control.utils';
import { ChartDataResponse, ChartScope, ChartType } from './dto/get-charts-query.dto';
import { UserSource, ProjectVisibility } from '@prisma/client';

export interface KPIMetrics {
  totalWorkspaces: number;
  activeWorkspaces: number;
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalMembers: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  totalBugs: number;
  resolvedBugs: number;
  activeSprints: number;
  projectCompletionRate: number;
  taskCompletionRate: number;
  bugResolutionRate: number;
  overallProductivity: number;
}

export interface QualityMetrics {
  totalBugs: number;
  resolvedBugs: number;
  criticalBugs: number;
  resolvedCriticalBugs: number;
  bugResolutionRate: number;
  criticalBugResolutionRate: number;
}

export interface WorkspaceProjectCount {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  projectCount: number;
}

export interface MemberWorkload {
  memberId: string;
  memberName: string;
  activeTasks: number;
  reportedTasks: number;
}

export type ManagementRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ManagementWorkloadLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ManagementTaskOverview {
  totalTasks: number;
  activeTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  overdueTasks: number;
  blockedTasks: number;
  dueSoonTasks: number;
  completionRate: number;
  overdueRate: number;
}

export interface ManagementProgressRow {
  totalTasks: number;
  activeTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  overdueTasks: number;
  blockedTasks: number;
  completionRate: number;
}

export interface ManagementSummary {
  taskOverview: ManagementTaskOverview;
  workspaceProgress: Array<
    ManagementProgressRow & {
      workspaceId: string;
      workspaceName: string;
      workspaceSlug: string;
    }
  >;
  projectProgress: Array<
    ManagementProgressRow & {
      projectId: string;
      projectName: string;
      projectSlug: string;
      workspaceName: string;
      status: string;
      priority: string;
      endDate: Date | null;
      openRisks: number;
      riskLevel: ManagementRiskLevel;
      latestHealth: string | null;
      latestSummary: string | null;
    }
  >;
  memberProgress: Array<
    ManagementProgressRow & {
      memberId: string;
      memberName: string;
      email: string | null;
      assignedTasks: number;
      workloadLevel: ManagementWorkloadLevel;
    }
  >;
  deadlinePerformance: Array<{
    label: 'overdue' | 'dueSoon' | 'noDueDate';
    count: number;
  }>;
  riskAlerts: Array<{
    projectId: string;
    projectName: string;
    projectSlug: string;
    severity: ManagementRiskLevel;
    message: string;
    signals: string[];
    endDate: Date | null;
  }>;
  blockers: Array<{
    taskId: string;
    taskTitle: string;
    projectId: string;
    projectName: string;
    projectSlug: string;
    reason: string;
    blockingTaskTitle: string | null;
    dueDate: Date | null;
    assigneeNames: string[];
  }>;
  delayedTasks: Array<{
    taskId: string;
    taskTitle: string;
    projectId: string;
    projectName: string;
    projectSlug: string;
    dueDate: Date | null;
    priority: string;
    reason: 'overdue' | 'blocked';
    assigneeNames: string[];
  }>;
  quickReport: {
    generatedAt: string;
    totalProjects: number;
    atRiskProjects: number;
    overloadedMembers: number;
    overdueTasks: number;
    blockedTasks: number;
    topRiskProject: string | null;
  };
}

type ManagementProjectRecord = {
  id: string;
  name: string;
  slug: string;
  status: string;
  priority: string;
  endDate: Date | null;
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
  statusUpdates: Array<{
    health: string;
    summary: string;
    createdAt: Date;
  }>;
  risks: Array<{
    id: string;
    title: string;
    severity: string;
    status: string;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    priority: string;
    dueDate: Date | null;
    completedAt: Date | null;
    isBlocked: boolean;
    blockedReason: string | null;
    status: {
      name: string;
      category: string;
    } | null;
    assignees: Array<{
      user: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        email: string | null;
      };
    }>;
    dependsOn: Array<{
      id: string;
      type: string;
      blockingTask: {
        id: string;
        title: string;
        completedAt: Date | null;
      };
    }>;
  }>;
};

type OrganizationChartFilters = {
  workspaceId?: string;
  projectId?: string;
  minMemberCount?: number;
  scope?: ChartScope;
};

@Injectable()
export class OrganizationChartsService {
  private readonly logger = new Logger(OrganizationChartsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
  ) {}

  /**
   * Get multiple chart data types in a single request
   */
  async getMultipleChartData(
    orgId: string,
    userId: string,
    chartTypes: ChartType[],
    filters: OrganizationChartFilters = {},
  ): Promise<ChartDataResponse> {
    this.logger.log(
      `Fetching chart data for organization ${orgId}, types: ${chartTypes.join(', ')} with filters: ${JSON.stringify(filters)}`,
    );

    try {
      // Execute all chart requests in parallel for better performance
      const chartPromises = chartTypes.map(async (type) => {
        try {
          const data = await this.getSingleChartData(orgId, userId, type, filters);
          return { type, data, error: null };
        } catch (error) {
          this.logger.error(
            `Failed to fetch chart data for type ${type}: ${error.message}`,
            error.stack,
          );
          return { type, data: null, error: error.message };
        }
      });

      const chartResults = await Promise.all(chartPromises);

      // Build response object
      const results: ChartDataResponse = {};
      chartResults.forEach(({ type, data, error }) => {
        results[type] = error ? { error } : data;
      });

      this.logger.log(`Successfully fetched chart data for ${chartTypes.length} chart types`);
      return results;
    } catch (error) {
      this.logger.error(
        `Failed to fetch chart data for organization ${orgId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get single chart data based on type
   */
  private async getSingleChartData(
    orgId: string,
    userId: string,
    chartType: ChartType,
    filters: OrganizationChartFilters = {},
  ): Promise<any> {
    switch (chartType) {
      case ChartType.KPI_METRICS:
        return this.organizationKPIMetrics(orgId, userId, filters.scope);
      case ChartType.PROJECT_PORTFOLIO:
        return this.organizationProjectPortfolio(orgId, userId, filters.scope);
      case ChartType.TEAM_UTILIZATION:
        return this.organizationTeamUtilization(orgId, userId, filters.workspaceId, filters.scope);
      case ChartType.TASK_DISTRIBUTION:
        return this.organizationTaskDistribution(orgId, userId, filters.scope);
      case ChartType.TASK_TYPE:
        return this.organizationTaskTypeDistribution(orgId, userId, filters.scope);
      case ChartType.SPRINT_METRICS:
        return this.organizationSprintMetrics(orgId, userId, filters.scope);
      case ChartType.QUALITY_METRICS:
        return this.organizationQualityMetrics(orgId, userId, filters.scope);
      case ChartType.WORKSPACE_PROJECT_COUNT:
        return this.organizationWorkspaceProjectCount(orgId, userId, filters.scope);
      case ChartType.MEMBER_WORKLOAD:
        return this.organizationMemberWorkload(orgId, userId, filters.scope);
      case ChartType.RESOURCE_ALLOCATION:
        return this.organizationResourceAllocation(orgId, userId, filters.projectId, filters.scope);
      case ChartType.MANAGEMENT_SUMMARY:
        return this.organizationManagementSummary(orgId, userId, filters.scope);
      default:
        throw new BadRequestException(`Unsupported chart type: ${String(chartType)}`);
    }
  }

  /**
   * Helper method to calculate percentage with proper rounding
   */
  private calculatePercentage(numerator: number, denominator: number): number {
    if (denominator === 0) return 0;
    return Math.round((numerator / denominator) * 100 * 100) / 100;
  }

  private createProgressRow(): ManagementProgressRow {
    return {
      totalTasks: 0,
      activeTasks: 0,
      inProgressTasks: 0,
      completedTasks: 0,
      overdueTasks: 0,
      blockedTasks: 0,
      completionRate: 0,
    };
  }

  private getDisplayName(user: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  }): string {
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User';
  }

  private riskWeight(level: ManagementRiskLevel): number {
    const weights: Record<ManagementRiskLevel, number> = {
      LOW: 0,
      MEDIUM: 1,
      HIGH: 2,
      CRITICAL: 3,
    };
    return weights[level];
  }

  private workloadWeight(level: ManagementWorkloadLevel): number {
    const weights: Record<ManagementWorkloadLevel, number> = {
      LOW: 0,
      MEDIUM: 1,
      HIGH: 2,
    };
    return weights[level];
  }

  private getMemberWorkloadLevel(
    activeTasks: number,
    overdueTasks: number,
    blockedTasks: number,
  ): ManagementWorkloadLevel {
    if (activeTasks >= 10 || (overdueTasks > 0 && blockedTasks > 0)) return 'HIGH';
    if (activeTasks >= 5 || overdueTasks > 0 || blockedTasks > 0) return 'MEDIUM';
    return 'LOW';
  }

  private getProjectRiskLevel(input: {
    overdueTasks: number;
    blockedTasks: number;
    completionRate: number;
    dueSoonTasks: number;
    latestHealth: string | null;
    riskSeverities: string[];
  }): ManagementRiskLevel {
    const hasCriticalRisk = input.riskSeverities.includes('CRITICAL');
    const hasHighRisk = input.riskSeverities.includes('HIGH');

    if (
      input.latestHealth === 'OFF_TRACK' ||
      hasCriticalRisk ||
      (input.overdueTasks > 0 && input.blockedTasks > 0)
    ) {
      return 'CRITICAL';
    }

    if (
      input.latestHealth === 'AT_RISK' ||
      hasHighRisk ||
      input.blockedTasks > 0 ||
      input.overdueTasks >= 3 ||
      (input.dueSoonTasks > 0 && input.completionRate < 70)
    ) {
      return 'HIGH';
    }

    if (input.overdueTasks > 0 || input.dueSoonTasks > 0 || input.riskSeverities.length > 0) {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  /**
   * Reusable scoped where fragments when not elevated
   * - Projects: user must be a member
   * - Workspaces: user must be a member
   * - Tasks: assigned to or reported by the user
   */
  private userScopedWhere(orgId: string, userId: string) {
    return {
      workspaceForUser: {
        organizationId: orgId,
        archive: false,
        OR: [
          { members: { some: { userId } } },
          { projects: { some: { visibility: ProjectVisibility.PUBLIC } } },
        ],
      },
      projectForUser: {
        archive: false,
        workspace: { organizationId: orgId, archive: false },
        OR: [
          { members: { some: { userId } } },
          { visibility: ProjectVisibility.PUBLIC },
          {
            visibility: ProjectVisibility.INTERNAL,
            workspace: { members: { some: { userId } } },
          },
        ],
      },
      taskForUser: {
        isArchived: false,
        project: {
          workspace: { organizationId: orgId, archive: false },
          archive: false,
          OR: [
            { members: { some: { userId } } },
            { visibility: ProjectVisibility.PUBLIC },
            {
              visibility: ProjectVisibility.INTERNAL,
              workspace: { members: { some: { userId } } },
            },
          ],
        },
        OR: [
          { assignees: { some: { userId: userId } } },
          { reporters: { some: { userId: userId } } },
        ],
      },
      sprintForUser: {
        archive: false,
        project: {
          archive: false,
          workspace: { organizationId: orgId, archive: false },
          OR: [
            { members: { some: { userId } } },
            { visibility: ProjectVisibility.PUBLIC },
            {
              visibility: ProjectVisibility.INTERNAL,
              workspace: { members: { some: { userId } } },
            },
          ],
        },
      },
    };
  }

  private visibleWorkspaceWhere(orgId: string, userId: string, isSuperAdmin: boolean, isElevated: boolean) {
    return {
      organizationId: orgId,
      archive: false,
      ...(isSuperAdmin || isElevated
        ? {}
        : {
            members: { some: { userId } },
          }),
    };
  }

  private visibleProjectWhere(orgId: string, userId: string, isSuperAdmin: boolean, isElevated: boolean) {
    return {
      archive: false,
      workspace: { organizationId: orgId, archive: false },
      ...(isSuperAdmin || isElevated ? {} : { 
        OR: [
          { members: { some: { userId } } },
          { visibility: ProjectVisibility.PUBLIC },
          { visibility: ProjectVisibility.INTERNAL, workspace: { members: { some: { userId } } } }
        ]
      }),
    };
  }

  private visibleTaskWhere(orgId: string, userId: string, isSuperAdmin: boolean, isElevated: boolean) {
    return {
      isArchived: false,
      project: this.visibleProjectWhere(orgId, userId, isSuperAdmin, isElevated),
    };
  }

  private visibleSprintWhere(orgId: string, userId: string, isSuperAdmin: boolean, isElevated: boolean) {
    return {
      archive: false,
      project: this.visibleProjectWhere(orgId, userId, isSuperAdmin, isElevated),
    };
  }

  /**
   * 1) KPI Metrics
   */
  async organizationKPIMetrics(
    orgId: string,
    userId: string,
    scope: ChartScope = ChartScope.ORGANIZATION,
  ): Promise<KPIMetrics> {
    const access = await this.accessControl.getOrgAccess(orgId, userId);
    const isSuperAdmin = Boolean(access.isSuperAdmin);
    const isElevated = Boolean(access.isElevated);
    const isPersonal = scope === ChartScope.PERSONAL;
    const now = new Date();
    const scoped = this.userScopedWhere(orgId, userId);
    const workspaceWhere = isPersonal
      ? scoped.workspaceForUser
      : this.visibleWorkspaceWhere(orgId, userId, isSuperAdmin, isElevated);
    const projectWhere = isPersonal
      ? scoped.projectForUser
      : this.visibleProjectWhere(orgId, userId, isSuperAdmin, isElevated);
    const taskWhere = isPersonal
      ? scoped.taskForUser
      : this.visibleTaskWhere(orgId, userId, isSuperAdmin, isElevated);
    const sprintWhere = isPersonal
      ? scoped.sprintForUser
      : this.visibleSprintWhere(orgId, userId, isSuperAdmin, isElevated);

    const [
      totalWorkspaces,
      activeWorkspaces,
      totalProjects,
      activeProjects,
      completedProjects,
      totalTasks,
      completedTasks,
      overdueTasks,
      totalBugs,
      resolvedBugs,
      activeSprints,
      totalMembers,
    ] = await Promise.all([
      this.prisma.workspace.count({ where: workspaceWhere }),
      this.prisma.workspace.count({ where: workspaceWhere }),
      this.prisma.project.count({ where: projectWhere }),
      this.prisma.project.count({
        where: { ...projectWhere, status: 'ACTIVE' },
      }),
      this.prisma.project.count({
        where: { ...projectWhere, status: 'COMPLETED' },
      }),
      this.prisma.task.count({ where: taskWhere }),
      this.prisma.task.count({
        where: { ...taskWhere, completedAt: { not: null } },
      }),
      this.prisma.task.count({
        where: {
          ...taskWhere,
          dueDate: { lt: now },
          completedAt: null,
        },
      }),
      this.prisma.task.count({ where: { ...taskWhere, type: 'BUG' } }),
      this.prisma.task.count({
        where: {
          ...taskWhere,
          type: 'BUG',
          completedAt: { not: null },
        },
      }),
      this.prisma.sprint.count({
        where: { ...sprintWhere, status: 'ACTIVE' },
      }),
      this.prisma.organizationMember.count({
        where: isPersonal ? { organizationId: orgId, userId } : { organizationId: orgId },
      }),
    ]);

    return {
      totalWorkspaces,
      activeWorkspaces,
      totalProjects,
      activeProjects,
      completedProjects,
      totalMembers,
      totalTasks,
      completedTasks,
      overdueTasks,
      totalBugs,
      resolvedBugs,
      activeSprints,
      projectCompletionRate: this.calculatePercentage(completedProjects, totalProjects),
      taskCompletionRate: this.calculatePercentage(completedTasks, totalTasks),
      bugResolutionRate: this.calculatePercentage(resolvedBugs, totalBugs),
      overallProductivity: this.calculatePercentage(completedTasks, totalTasks),
    };
  }

  /**
   * 2) Project Portfolio
   */
  async organizationProjectPortfolio(
    orgId: string,
    userId: string,
    scope: ChartScope = ChartScope.ORGANIZATION,
  ) {
    const access = await this.accessControl.getOrgAccess(orgId, userId);
    const where =
      scope === ChartScope.PERSONAL
        ? this.userScopedWhere(orgId, userId).projectForUser
        : this.visibleProjectWhere(orgId, userId, Boolean(access.isSuperAdmin), Boolean(access.isElevated));

    return this.prisma.project.groupBy({
      by: ['status'],
      where,
      _count: { status: true },
    });
  }

  /**
   * 3) Team Utilization (roles distribution)
   */
  async organizationTeamUtilization(
    orgId: string,
    userId: string,
    workspaceId?: string,
    scope: ChartScope = ChartScope.ORGANIZATION,
  ) {
    const { isElevated } = await this.accessControl.getOrgAccess(orgId, userId);
    const isOrganizationWide = scope !== ChartScope.PERSONAL && isElevated;

    if (workspaceId) {
      // If workspaceId is provided, group by role in that workspace
      return this.prisma.workspaceMember.groupBy({
        by: ['role'],
        where: isOrganizationWide ? { workspaceId } : { workspaceId, userId },
        _count: { role: true },
      });
    }

    if (isOrganizationWide) {
      return this.prisma.organizationMember.groupBy({
        by: ['role'],
        where: { organizationId: orgId },
        _count: { role: true },
      });
    }

    const me = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId: orgId } },
      select: { role: true },
    });

    return me ? [{ role: me.role, _count: { role: 1 } }] : [];
  }

  /**
   * 4) Task Distribution by Priority
   */
  async organizationTaskDistribution(
    orgId: string,
    userId: string,
    scope: ChartScope = ChartScope.ORGANIZATION,
  ) {
    const access = await this.accessControl.getOrgAccess(orgId, userId);
    const where =
      scope === ChartScope.PERSONAL
        ? this.userScopedWhere(orgId, userId).taskForUser
        : this.visibleTaskWhere(orgId, userId, Boolean(access.isSuperAdmin), Boolean(access.isElevated));

    return this.prisma.task.groupBy({
      by: ['priority'],
      where,
      _count: { priority: true },
    });
  }

  /**
   * 5) Task Type Distribution
   */
  async organizationTaskTypeDistribution(
    orgId: string,
    userId: string,
    scope: ChartScope = ChartScope.ORGANIZATION,
  ) {
    const access = await this.accessControl.getOrgAccess(orgId, userId);
    const where =
      scope === ChartScope.PERSONAL
        ? this.userScopedWhere(orgId, userId).taskForUser
        : this.visibleTaskWhere(orgId, userId, Boolean(access.isSuperAdmin), Boolean(access.isElevated));

    return this.prisma.task.groupBy({
      by: ['type'],
      where,
      _count: { type: true },
    });
  }

  /**
   * 6) Sprint Metrics
   */
  async organizationSprintMetrics(
    orgId: string,
    userId: string,
    scope: ChartScope = ChartScope.ORGANIZATION,
  ) {
    const access = await this.accessControl.getOrgAccess(orgId, userId);
    const where =
      scope === ChartScope.PERSONAL
        ? this.userScopedWhere(orgId, userId).sprintForUser
        : this.visibleSprintWhere(orgId, userId, Boolean(access.isSuperAdmin), Boolean(access.isElevated));

    const sprints = await this.prisma.sprint.findMany({
      where,
      select: { id: true, status: true },
    });

    return this.prisma.sprint.groupBy({
      by: ['status'],
      where: {
        id: { in: sprints.map((s) => s.id) },
      },
      _count: { status: true },
    });
  }

  /**
   * 7) Quality Metrics (bugs)
   */
  async organizationQualityMetrics(
    orgId: string,
    userId: string,
    scope: ChartScope = ChartScope.ORGANIZATION,
  ): Promise<QualityMetrics> {
    const access = await this.accessControl.getOrgAccess(orgId, userId);
    const where = {
      ...(scope === ChartScope.PERSONAL
        ? this.userScopedWhere(orgId, userId).taskForUser
        : this.visibleTaskWhere(orgId, userId, Boolean(access.isSuperAdmin), Boolean(access.isElevated))),
      type: 'BUG' as const,
    };

    const [totalBugs, resolvedBugs, criticalBugs, resolvedCriticalBugs] = await Promise.all([
      this.prisma.task.count({ where }),
      this.prisma.task.count({
        where: { ...where, completedAt: { not: null } },
      }),
      this.prisma.task.count({
        where: { ...where, priority: { in: ['HIGH', 'HIGHEST'] } },
      }),
      this.prisma.task.count({
        where: {
          ...where,
          priority: { in: ['HIGH', 'HIGHEST'] },
          completedAt: { not: null },
        },
      }),
    ]);

    return {
      totalBugs,
      resolvedBugs,
      criticalBugs,
      resolvedCriticalBugs,
      bugResolutionRate: this.calculatePercentage(resolvedBugs, totalBugs),
      criticalBugResolutionRate: this.calculatePercentage(resolvedCriticalBugs, criticalBugs),
    };
  }

  /**
   * 8) Workspace Project Count
   */
  async organizationWorkspaceProjectCount(
    orgId: string,
    userId: string,
    scope: ChartScope = ChartScope.ORGANIZATION,
  ): Promise<WorkspaceProjectCount[]> {
    const access = await this.accessControl.getOrgAccess(orgId, userId);
    const isSuperAdmin = Boolean(access.isSuperAdmin);
    const isElevated = Boolean(access.isElevated);
    const isPersonal = scope === ChartScope.PERSONAL;
    const scoped = this.userScopedWhere(orgId, userId);
    const projectCountWhere = isPersonal
      ? {
          archive: false,
          OR: [
            { members: { some: { userId } } },
            { visibility: ProjectVisibility.PUBLIC },
            {
              visibility: ProjectVisibility.INTERNAL,
              workspace: { members: { some: { userId } } },
            },
          ],
        }
      : {
          archive: false,
          ...(isSuperAdmin || isElevated ? {} : { members: { some: { userId } } }),
        };

    const workspaces = await this.prisma.workspace.findMany({
      where: isPersonal
        ? scoped.workspaceForUser
        : this.visibleWorkspaceWhere(orgId, userId, isSuperAdmin, isElevated),
      select: {
        id: true,
        name: true,
        slug: true,
        _count: {
          select: {
            projects: { where: projectCountWhere },
          },
        },
      },
      orderBy: { projects: { _count: 'desc' } },
    });

    return workspaces.map((w) => ({
      workspaceId: w.id,
      workspaceName: w.name,
      workspaceSlug: w.slug,
      projectCount: w._count.projects,
    }));
  }

  /**
   * 9) Member Workload Distribution
   */
  async organizationMemberWorkload(
    orgId: string,
    userId: string,
    scope: ChartScope = ChartScope.ORGANIZATION,
  ): Promise<MemberWorkload[]> {
    const access = await this.accessControl.getOrgAccess(orgId, userId);
    const isOrganizationWide =
      scope !== ChartScope.PERSONAL && (access.isElevated || access.isSuperAdmin);
    const taskWhere =
      scope === ChartScope.PERSONAL
        ? this.userScopedWhere(orgId, userId).taskForUser
        : this.visibleTaskWhere(orgId, userId, Boolean(access.isSuperAdmin), Boolean(access.isElevated));

    const userWhere = isOrganizationWide
      ? {
          organizationMembers: { some: { organizationId: orgId } },
          source: { not: UserSource.EMAIL_INBOX },
        }
      : {
          id: userId,
          organizationMembers: {
            some: { organizationId: orgId },
          },
          source: { not: UserSource.EMAIL_INBOX },
        };
    const members = await this.prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        _count: {
          select: {
            taskAssignees: {
              where: {
                task: {
                  ...taskWhere,
                  completedAt: null,
                },
              },
            },
            taskReporters: {
              where: {
                task: taskWhere,
              },
            },
          },
        },
      },
      orderBy: isOrganizationWide ? { taskAssignees: { _count: 'desc' } } : undefined,
    });

    return members.map((m) => ({
      memberId: m.id,
      memberName: `${m.firstName || ''} ${m.lastName || ''}`.trim() || 'Unknown User',
      activeTasks: m._count.taskAssignees,
      reportedTasks: m._count.taskReporters,
    }));
  }

  async organizationManagementSummary(
    orgId: string,
    userId: string,
    scope: ChartScope = ChartScope.ORGANIZATION,
  ): Promise<ManagementSummary> {
    const access = await this.accessControl.getOrgAccess(orgId, userId);
    const isPersonal = scope === ChartScope.PERSONAL;
    const now = new Date();
    const dueSoonCutoff = new Date(now);
    dueSoonCutoff.setDate(dueSoonCutoff.getDate() + 7);

    const projectWhere = isPersonal
      ? this.userScopedWhere(orgId, userId).projectForUser
      : this.visibleProjectWhere(orgId, userId, Boolean(access.isSuperAdmin), Boolean(access.isElevated));
    const taskWhere = isPersonal
      ? {
          isArchived: false,
          OR: [{ assignees: { some: { userId } } }, { reporters: { some: { userId } } }],
        }
      : { isArchived: false };

    const projects = (await this.prisma.project.findMany({
      where: projectWhere,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        priority: true,
        endDate: true,
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        statusUpdates: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            health: true,
            summary: true,
            createdAt: true,
          },
        },
        risks: {
          where: {
            status: { not: 'CLOSED' },
          },
          select: {
            id: true,
            title: true,
            severity: true,
            status: true,
          },
        },
        tasks: {
          where: taskWhere,
          select: {
            id: true,
            title: true,
            priority: true,
            dueDate: true,
            completedAt: true,
            isBlocked: true,
            blockedReason: true,
            status: {
              select: {
                name: true,
                category: true,
              },
            },
            assignees: {
              select: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
            dependsOn: {
              where: {
                blockingTask: {
                  completedAt: null,
                },
              },
              select: {
                id: true,
                type: true,
                blockingTask: {
                  select: {
                    id: true,
                    title: true,
                    completedAt: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })) as ManagementProjectRecord[];

    const visibleWorkspaces = await this.prisma.workspace.findMany({
      where: isPersonal ? this.userScopedWhere(orgId, userId).workspaceForUser : this.visibleWorkspaceWhere(orgId, userId, Boolean(access.isSuperAdmin), Boolean(access.isElevated)),
      select: { id: true, name: true, slug: true }
    });

    const taskOverview: ManagementTaskOverview = {
      totalTasks: 0,
      activeTasks: 0,
      inProgressTasks: 0,
      completedTasks: 0,
      overdueTasks: 0,
      blockedTasks: 0,
      dueSoonTasks: 0,
      completionRate: 0,
      overdueRate: 0,
    };
    const workspaceProgress = new Map<
      string,
      ManagementProgressRow & {
        workspaceId: string;
        workspaceName: string;
        workspaceSlug: string;
      }
    >();
    
    // Initialize all visible workspaces
    for (const ws of visibleWorkspaces) {
      workspaceProgress.set(ws.id, {
        ...this.createProgressRow(),
        workspaceId: ws.id,
        workspaceName: ws.name,
        workspaceSlug: ws.slug,
      });
    }
    const memberProgress = new Map<
      string,
      ManagementProgressRow & {
        memberId: string;
        memberName: string;
        email: string | null;
        assignedTasks: number;
        workloadLevel: ManagementWorkloadLevel;
      }
    >();
    const projectProgress: ManagementSummary['projectProgress'] = [];
    const riskAlerts: ManagementSummary['riskAlerts'] = [];
    const blockers: ManagementSummary['blockers'] = [];
    const delayedTasks: ManagementSummary['delayedTasks'] = [];
    let noDueDateOpenTasks = 0;

    for (const project of projects) {
      const projectRow = {
        ...this.createProgressRow(),
        projectId: project.id,
        projectName: project.name,
        projectSlug: project.slug,
        workspaceName: project.workspace.name,
        status: project.status,
        priority: project.priority,
        endDate: project.endDate,
        openRisks: project.risks.length,
        riskLevel: 'LOW' as ManagementRiskLevel,
        latestHealth: project.statusUpdates[0]?.health ?? null,
        latestSummary: project.statusUpdates[0]?.summary ?? null,
      };

      if (!workspaceProgress.has(project.workspace.id)) {
        workspaceProgress.set(project.workspace.id, {
          ...this.createProgressRow(),
          workspaceId: project.workspace.id,
          workspaceName: project.workspace.name,
          workspaceSlug: project.workspace.slug,
        });
      }
      const workspaceRow = workspaceProgress.get(project.workspace.id)!;

      let projectDueSoonTasks = 0;
      for (const task of project.tasks) {
        const isCompleted = Boolean(task.completedAt || task.status?.category === 'DONE');
        const isOpen = !isCompleted;
        const isInProgress = isOpen && task.status?.category === 'IN_PROGRESS';
        const isOverdue = Boolean(isOpen && task.dueDate && task.dueDate < now);
        const isDueSoon = Boolean(
          isOpen && task.dueDate && task.dueDate >= now && task.dueDate <= dueSoonCutoff,
        );
        const blockingDependency = task.dependsOn.find(
          (dependency) => !dependency.blockingTask.completedAt,
        );
        const isBlocked = Boolean(isOpen && (task.isBlocked || blockingDependency));
        const assigneeNames = task.assignees.map((assignee) => this.getDisplayName(assignee.user));

        taskOverview.totalTasks += 1;
        projectRow.totalTasks += 1;
        workspaceRow.totalTasks += 1;

        if (isCompleted) {
          taskOverview.completedTasks += 1;
          projectRow.completedTasks += 1;
          workspaceRow.completedTasks += 1;
        } else {
          taskOverview.activeTasks += 1;
          projectRow.activeTasks += 1;
          workspaceRow.activeTasks += 1;
        }

        if (isInProgress) {
          taskOverview.inProgressTasks += 1;
          projectRow.inProgressTasks += 1;
          workspaceRow.inProgressTasks += 1;
        }

        if (isOverdue) {
          taskOverview.overdueTasks += 1;
          projectRow.overdueTasks += 1;
          workspaceRow.overdueTasks += 1;
          delayedTasks.push({
            taskId: task.id,
            taskTitle: task.title,
            projectId: project.id,
            projectName: project.name,
            projectSlug: project.slug,
            dueDate: task.dueDate,
            priority: task.priority,
            reason: 'overdue',
            assigneeNames,
          });
        }

        if (isDueSoon) {
          taskOverview.dueSoonTasks += 1;
          projectDueSoonTasks += 1;
        }

        if (isOpen && !task.dueDate) {
          noDueDateOpenTasks += 1;
        }

        if (isBlocked) {
          taskOverview.blockedTasks += 1;
          projectRow.blockedTasks += 1;
          workspaceRow.blockedTasks += 1;

          const reason = task.blockedReason || 'Blocked by dependency';
          const blocker = {
            taskId: task.id,
            taskTitle: task.title,
            projectId: project.id,
            projectName: project.name,
            projectSlug: project.slug,
            reason,
            blockingTaskTitle: blockingDependency?.blockingTask.title ?? null,
            dueDate: task.dueDate,
            assigneeNames,
          };
          blockers.push(blocker);

          if (!isOverdue) {
            delayedTasks.push({
              taskId: task.id,
              taskTitle: task.title,
              projectId: project.id,
              projectName: project.name,
              projectSlug: project.slug,
              dueDate: task.dueDate,
              priority: task.priority,
              reason: 'blocked',
              assigneeNames,
            });
          }
        }

        for (const assignee of task.assignees) {
          const member = assignee.user;
          if (!memberProgress.has(member.id)) {
            memberProgress.set(member.id, {
              ...this.createProgressRow(),
              memberId: member.id,
              memberName: this.getDisplayName(member),
              email: member.email,
              assignedTasks: 0,
              workloadLevel: 'LOW',
            });
          }

          const memberRow = memberProgress.get(member.id)!;
          memberRow.assignedTasks += 1;
          memberRow.totalTasks += 1;
          if (isCompleted) {
            memberRow.completedTasks += 1;
          } else {
            memberRow.activeTasks += 1;
          }
          if (isInProgress) memberRow.inProgressTasks += 1;
          if (isOverdue) memberRow.overdueTasks += 1;
          if (isBlocked) memberRow.blockedTasks += 1;
        }
      }

      projectRow.completionRate = this.calculatePercentage(
        projectRow.completedTasks,
        projectRow.totalTasks,
      );
      projectRow.riskLevel = this.getProjectRiskLevel({
        overdueTasks: projectRow.overdueTasks,
        blockedTasks: projectRow.blockedTasks,
        completionRate: projectRow.completionRate,
        dueSoonTasks: projectDueSoonTasks,
        latestHealth: projectRow.latestHealth,
        riskSeverities: project.risks.map((risk) => risk.severity),
      });
      projectProgress.push(projectRow);

      if (projectRow.riskLevel !== 'LOW') {
        const signals = [
          projectRow.overdueTasks > 0 ? `${projectRow.overdueTasks} overdue tasks` : null,
          projectRow.blockedTasks > 0 ? `${projectRow.blockedTasks} blockers` : null,
          project.risks.length > 0 ? `${project.risks.length} open risks` : null,
          projectRow.latestHealth ? `latest health ${projectRow.latestHealth}` : null,
        ].filter((signal): signal is string => Boolean(signal));

        riskAlerts.push({
          projectId: project.id,
          projectName: project.name,
          projectSlug: project.slug,
          severity: projectRow.riskLevel,
          message: signals.length > 0 ? signals.join(', ') : 'Project requires attention',
          signals,
          endDate: project.endDate,
        });
      }
    }

    taskOverview.completionRate = this.calculatePercentage(
      taskOverview.completedTasks,
      taskOverview.totalTasks,
    );
    taskOverview.overdueRate = this.calculatePercentage(
      taskOverview.overdueTasks,
      taskOverview.activeTasks,
    );

    const workspaceRows = Array.from(workspaceProgress.values()).map((workspace) => ({
      ...workspace,
      completionRate: this.calculatePercentage(workspace.completedTasks, workspace.totalTasks),
    }));
    const memberRows = Array.from(memberProgress.values()).map((member) => ({
      ...member,
      completionRate: this.calculatePercentage(member.completedTasks, member.totalTasks),
      workloadLevel: this.getMemberWorkloadLevel(
        member.activeTasks,
        member.overdueTasks,
        member.blockedTasks,
      ),
    }));

    const sortedRiskAlerts = riskAlerts.sort(
      (a, b) => this.riskWeight(b.severity) - this.riskWeight(a.severity),
    );
    const sortedProjectProgress = projectProgress.sort((a, b) => {
      const riskDifference = this.riskWeight(b.riskLevel) - this.riskWeight(a.riskLevel);
      if (riskDifference !== 0) return riskDifference;
      return b.overdueTasks + b.blockedTasks - (a.overdueTasks + a.blockedTasks);
    });
    const sortedDelayedTasks = delayedTasks.sort((a, b) => {
      const aDue = a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bDue = b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aDue - bDue;
    });
    const sortedBlockers = blockers.sort((a, b) => {
      const aDue = a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bDue = b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aDue - bDue;
    });
    const sortedMembers = memberRows.sort((a, b) => {
      const workloadDifference =
        this.workloadWeight(b.workloadLevel) - this.workloadWeight(a.workloadLevel);
      if (workloadDifference !== 0) return workloadDifference;
      return b.activeTasks - a.activeTasks;
    });

    return {
      taskOverview,
      workspaceProgress: workspaceRows.sort((a, b) => b.totalTasks - a.totalTasks),
      projectProgress: sortedProjectProgress.slice(0, 10),
      memberProgress: sortedMembers.slice(0, 10),
      deadlinePerformance: [
        { label: 'overdue', count: taskOverview.overdueTasks },
        { label: 'dueSoon', count: taskOverview.dueSoonTasks },
        { label: 'noDueDate', count: noDueDateOpenTasks },
      ],
      riskAlerts: sortedRiskAlerts.slice(0, 8),
      blockers: sortedBlockers.slice(0, 8),
      delayedTasks: sortedDelayedTasks.slice(0, 8),
      quickReport: {
        generatedAt: now.toISOString(),
        totalProjects: projects.length,
        atRiskProjects: projectProgress.filter((project) => project.riskLevel !== 'LOW').length,
        overloadedMembers: memberRows.filter((member) => member.workloadLevel === 'HIGH').length,
        overdueTasks: taskOverview.overdueTasks,
        blockedTasks: taskOverview.blockedTasks,
        topRiskProject: sortedRiskAlerts[0]?.projectName ?? null,
      },
    };
  }

  /**
   * 10) Resource Allocation Matrix
   */
  async organizationResourceAllocation(
    orgId: string,
    userId: string,
    projectId?: string,
    scope: ChartScope = ChartScope.ORGANIZATION,
  ) {
    const { isElevated } = await this.accessControl.getOrgAccess(orgId, userId);
    const isOrganizationWide = scope !== ChartScope.PERSONAL && isElevated;

    if (projectId) {
      // If projectId is provided, group by role in that project
      return this.prisma.projectMember.groupBy({
        by: ['projectId', 'role'],
        where: isOrganizationWide ? { projectId } : { projectId, userId },
        _count: { role: true },
      });
    }

    const where = isOrganizationWide
      ? { workspace: { organizationId: orgId } }
      : { workspace: { organizationId: orgId, members: { some: { userId } } }, userId };

    return this.prisma.workspaceMember.groupBy({
      by: ['workspaceId', 'role'],
      where,
      _count: { role: true },
      orderBy: [{ workspaceId: 'asc' }, { role: 'asc' }],
    });
  }
}
