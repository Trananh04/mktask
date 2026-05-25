import { OrganizationChartsService } from './organizations-charts.service';
import { ChartScope, ChartType } from './dto/get-charts-query.dto';

describe('OrganizationChartsService personal chart scope', () => {
  const organizationId = '11111111-1111-4111-8111-111111111111';
  const managerId = '22222222-2222-4222-8222-222222222222';

  const createService = () => {
    const prisma: any = {
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const accessControl: any = {
      getOrgAccess: jest.fn().mockResolvedValue({ isElevated: true }),
    };

    return {
      service: new OrganizationChartsService(prisma, accessControl),
      prisma,
    };
  };

  it('limits member workload to the current user for elevated users requesting personal charts', async () => {
    const { service, prisma } = createService();

    await service.getMultipleChartData(organizationId, managerId, [ChartType.MEMBER_WORKLOAD], {
      scope: ChartScope.PERSONAL,
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: managerId }),
        orderBy: undefined,
      }),
    );
  });
});

describe('OrganizationChartsService management summary', () => {
  const organizationId = '11111111-1111-4111-8111-111111111111';
  const managerId = '22222222-2222-4222-8222-222222222222';

  const createService = (isElevated = true) => {
    const prisma: any = {
      project: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const accessControl: any = {
      getOrgAccess: jest.fn().mockResolvedValue({ isElevated }),
    };

    return {
      service: new OrganizationChartsService(prisma, accessControl),
      prisma,
    };
  };

  it('aggregates task counts, department progress, member workload, and project risk alerts', async () => {
    const { service, prisma } = createService();
    prisma.project.findMany.mockResolvedValue([
      {
        id: 'project-alpha',
        name: 'Alpha Launch',
        slug: 'alpha-launch',
        status: 'ACTIVE',
        priority: 'HIGH',
        endDate: new Date('2999-01-01T00:00:00.000Z'),
        workspace: {
          id: 'workspace-engineering',
          name: 'Engineering',
          slug: 'engineering',
        },
        statusUpdates: [
          {
            health: 'AT_RISK',
            summary: 'API approval is late',
            createdAt: new Date('2026-05-20T00:00:00.000Z'),
          },
        ],
        risks: [
          {
            id: 'risk-1',
            title: 'Vendor dependency',
            severity: 'HIGH',
            status: 'OPEN',
          },
        ],
        tasks: [
          {
            id: 'task-done',
            title: 'Write launch checklist',
            priority: 'MEDIUM',
            dueDate: new Date('2000-01-01T00:00:00.000Z'),
            completedAt: new Date('2026-05-01T00:00:00.000Z'),
            isBlocked: false,
            blockedReason: null,
            status: { name: 'Done', category: 'DONE' },
            assignees: [
              {
                user: {
                  id: 'user-alice',
                  firstName: 'Alice',
                  lastName: 'Nguyen',
                  email: 'alice@example.com',
                },
              },
            ],
            dependsOn: [],
          },
          {
            id: 'task-blocked',
            title: 'Finish payment API',
            priority: 'HIGH',
            dueDate: new Date('2000-01-01T00:00:00.000Z'),
            completedAt: null,
            isBlocked: true,
            blockedReason: 'Waiting for API contract',
            status: { name: 'In Progress', category: 'IN_PROGRESS' },
            assignees: [
              {
                user: {
                  id: 'user-alice',
                  firstName: 'Alice',
                  lastName: 'Nguyen',
                  email: 'alice@example.com',
                },
              },
            ],
            dependsOn: [
              {
                id: 'dependency-1',
                type: 'BLOCKS',
                blockingTask: {
                  id: 'task-contract',
                  title: 'Approve API contract',
                  completedAt: null,
                },
              },
            ],
          },
          {
            id: 'task-open',
            title: 'Prepare QA data',
            priority: 'LOW',
            dueDate: new Date('2999-01-01T00:00:00.000Z'),
            completedAt: null,
            isBlocked: false,
            blockedReason: null,
            status: { name: 'To Do', category: 'TODO' },
            assignees: [
              {
                user: {
                  id: 'user-bob',
                  firstName: 'Bob',
                  lastName: 'Tran',
                  email: 'bob@example.com',
                },
              },
            ],
            dependsOn: [],
          },
        ],
      },
    ]);

    const result = await service.getMultipleChartData(
      organizationId,
      managerId,
      [ChartType.MANAGEMENT_SUMMARY],
      {},
    );

    const summary = result[ChartType.MANAGEMENT_SUMMARY];
    expect(summary.taskOverview).toEqual(
      expect.objectContaining({
        totalTasks: 3,
        activeTasks: 2,
        completedTasks: 1,
        overdueTasks: 1,
        inProgressTasks: 1,
        blockedTasks: 1,
      }),
    );
    expect(summary.workspaceProgress).toEqual([
      expect.objectContaining({
        workspaceName: 'Engineering',
        totalTasks: 3,
        completedTasks: 1,
      }),
    ]);
    expect(summary.memberProgress).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          memberName: 'Alice Nguyen',
          assignedTasks: 2,
          activeTasks: 1,
          overdueTasks: 1,
          blockedTasks: 1,
        }),
      ]),
    );
    expect(summary.projectProgress).toEqual([
      expect.objectContaining({
        projectName: 'Alpha Launch',
        blockedTasks: 1,
        overdueTasks: 1,
        openRisks: 1,
        riskLevel: 'CRITICAL',
      }),
    ]);
    expect(summary.riskAlerts).toEqual([
      expect.objectContaining({
        projectName: 'Alpha Launch',
        severity: 'CRITICAL',
      }),
    ]);
    expect(summary.blockers).toEqual([
      expect.objectContaining({
        taskTitle: 'Finish payment API',
        reason: 'Waiting for API contract',
        blockingTaskTitle: 'Approve API contract',
      }),
    ]);
    expect(summary.quickReport).toEqual(
      expect.objectContaining({
        totalProjects: 1,
        atRiskProjects: 1,
        topRiskProject: 'Alpha Launch',
      }),
    );
  });

  it('uses personal project and task scope when requested by an elevated user', async () => {
    const { service, prisma } = createService(true);

    await service.getMultipleChartData(
      organizationId,
      managerId,
      [ChartType.MANAGEMENT_SUMMARY],
      { scope: ChartScope.PERSONAL },
    );

    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.any(Array),
        }),
        select: expect.objectContaining({
          tasks: expect.objectContaining({
            where: expect.objectContaining({
              OR: expect.any(Array),
            }),
          }),
        }),
      }),
    );
  });
});

describe('OrganizationChartsService visible KPI scope', () => {
  const organizationId = '11111111-1111-4111-8111-111111111111';
  const managerId = '22222222-2222-4222-8222-222222222222';

  it('counts only projects visible on the projects page for non-super-admin managers', async () => {
    const prisma: any = {
      workspace: {
        count: jest.fn().mockResolvedValue(1),
      },
      project: {
        count: jest.fn().mockResolvedValue(2),
      },
      organizationMember: {
        count: jest.fn().mockResolvedValue(1),
      },
      task: {
        count: jest.fn().mockResolvedValue(0),
      },
      sprint: {
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const accessControl: any = {
      getOrgAccess: jest.fn().mockResolvedValue({
        isElevated: true,
        isSuperAdmin: false,
      }),
    };
    const service = new OrganizationChartsService(prisma, accessControl);

    await service.organizationKPIMetrics(organizationId, managerId);

    expect(prisma.project.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          archive: false,
          members: { some: { userId: managerId } },
          workspace: { organizationId, archive: false },
        }),
      }),
    );
    expect(prisma.task.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isArchived: false,
          project: expect.objectContaining({
            archive: false,
            members: { some: { userId: managerId } },
            workspace: { organizationId, archive: false },
          }),
        }),
      }),
    );
  });
});
