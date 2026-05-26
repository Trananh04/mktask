import { Role } from '@prisma/client';
import { ProjectsService } from './projects.service';

describe('ProjectsService project listing', () => {
  const organizationId = '11111111-1111-4111-8111-111111111111';
  const managerId = '22222222-2222-4222-8222-222222222222';
  const workspaceId = '33333333-3333-4333-8333-333333333333';

  const createService = () => {
    const prisma: any = {
      organization: {
        findUnique: jest.fn().mockResolvedValue({ id: organizationId }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ role: Role.MEMBER }),
      },
      project: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const accessControl: any = {};

    return {
      service: new ProjectsService(prisma, accessControl, {} as any, {} as any),
      prisma,
    };
  };

  it('limits organization managers to projects where they are project members', async () => {
    const { service, prisma } = createService();

    await service.findByOrganizationId({ organizationId }, managerId);

    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          members: { some: { userId: managerId } },
        }),
      }),
    );
  });

  it('keeps organization members limited to projects where they are project members', async () => {
    const { service, prisma } = createService();

    await service.findByOrganizationId({ organizationId }, managerId);

    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          members: { some: { userId: managerId } },
        }),
      }),
    );
  });

  it('limits workspace managers to projects where they are project members', async () => {
    const { service, prisma } = createService();

    await service.findAll(workspaceId, managerId);

    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          members: { some: { userId: managerId } },
        }),
      }),
    );
  });
});

describe('ProjectsService project governance', () => {
  const projectId = '44444444-4444-4444-8444-444444444444';
  const userId = '55555555-5555-4555-8555-555555555555';

  const createService = () => {
    const prisma: any = {
      project: {
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      task: {
        findMany: jest.fn(),
      },
      taskDependency: {
        findMany: jest.fn(),
      },
      projectMilestone: {
        findMany: jest.fn(),
      },
      projectRisk: {
        findMany: jest.fn(),
      },
      projectStatusUpdate: {
        findFirst: jest.fn(),
      },
    };

    return {
      service: new ProjectsService(prisma, {} as any, {} as any, {} as any),
      prisma,
    };
  };

  it('updates project goal and scope for the overview layer', async () => {
    const { service, prisma } = createService();
    prisma.project.update.mockResolvedValue({
      id: projectId,
      goal: 'Release a usable beta',
      scope: 'Web app, AI planner, and reporting',
    });

    await service.updateOverview(projectId, {
      goal: 'Release a usable beta',
      scope: 'Web app, AI planner, and reporting',
    });

    expect(prisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: projectId },
        data: {
          goal: 'Release a usable beta',
          scope: 'Web app, AI planner, and reporting',
        },
      }),
    );
  });

  it('collects blocker and deadline facts for project health', async () => {
    const { service, prisma } = createService();
    prisma.project.findUnique.mockResolvedValue({
      id: projectId,
      name: 'Health Check',
      endDate: new Date('2026-06-30T00:00:00.000Z'),
    });
    prisma.task.findMany
      .mockResolvedValueOnce([
        {
          id: 'blocked-task',
          title: 'Ship approval flow',
          blockedReason: 'Waiting for legal review',
          dueDate: new Date('2026-05-20T00:00:00.000Z'),
          status: { name: 'In Progress', category: 'IN_PROGRESS' },
          assignees: [],
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'overdue-task',
          title: 'Close QA findings',
          dueDate: new Date('2026-05-21T00:00:00.000Z'),
          status: { name: 'To Do', category: 'TODO' },
          assignees: [],
        },
      ]);
    prisma.taskDependency.findMany.mockResolvedValue([
      {
        id: 'dependency-1',
        type: 'BLOCKS',
        blockingTask: { id: 'source-task', title: 'Approve API contract', completedAt: null },
        dependentTask: { id: 'blocked-task', title: 'Ship approval flow', completedAt: null },
      },
    ]);
    prisma.projectMilestone.findMany.mockResolvedValue([]);
    prisma.projectRisk.findMany.mockResolvedValue([]);
    prisma.projectStatusUpdate.findFirst.mockResolvedValue(null);

    const facts = await service.getProjectHealthFacts(projectId, userId, new Date('2026-05-22'));

    expect(facts.blockedTasks).toEqual([
      expect.objectContaining({
        id: 'blocked-task',
        blockedReason: 'Waiting for legal review',
      }),
    ]);
    expect(facts.overdueTasks).toEqual([expect.objectContaining({ id: 'overdue-task' })]);
    expect(facts.blockingDependencies).toEqual([
      expect.objectContaining({
        blockingTask: expect.objectContaining({ id: 'source-task' }),
        dependentTask: expect.objectContaining({ id: 'blocked-task' }),
      }),
    ]);
  });
});
