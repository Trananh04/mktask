jest.mock('mime', () => ({
  __esModule: true,
  default: { getType: jest.fn() },
  getType: jest.fn(),
}));

import { TasksService } from './tasks.service';
import { BadRequestException } from '@nestjs/common';

describe('TasksService task listing visibility', () => {
  const organizationId = '11111111-1111-4111-8111-111111111111';
  const managerId = '22222222-2222-4222-8222-222222222222';

  const createService = () => {
    const prisma: any = {
      organization: {
        findUnique: jest.fn().mockResolvedValue({ id: organizationId }),
      },
      task: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      taskAssignee: {
        groupBy: jest.fn().mockResolvedValue([]),
      },
      taskReporter: {
        groupBy: jest.fn().mockResolvedValue([]),
      },
      taskStatus: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    const accessControl: any = {
      getOrgAccess: jest.fn().mockResolvedValue({
        isElevated: true,
        isSuperAdmin: false,
      }),
    };

    return {
      service: new TasksService(
        prisma,
        accessControl,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      ),
      prisma,
    };
  };

  it('hides archived project tasks and tasks from projects the manager does not own or belong to', async () => {
    const { service, prisma } = createService();

    await service.findAll(
      organizationId,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      managerId,
    );

    expect(prisma.task.findMany).toHaveBeenCalledWith(
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

  it('only lists tasks where the user participates unless the user is a super admin', async () => {
    const { service, prisma } = createService();

    await service.findAll(
      organizationId,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      managerId,
    );

    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            {
              OR: [
                { assignees: { some: { userId: managerId } } },
                { reporters: { some: { userId: managerId } } },
                { createdBy: managerId },
              ],
            },
          ]),
        }),
      }),
    );
  });
});

describe('TasksService task assignment validation', () => {
  const projectId = '11111111-1111-4111-8111-111111111111';
  const creatorId = '22222222-2222-4222-8222-222222222222';
  const memberId = '33333333-3333-4333-8333-333333333333';
  const outsiderId = '44444444-4444-4444-8444-444444444444';

  const createService = () => {
    const prisma: any = {
      project: {
        findUnique: jest.fn().mockResolvedValue({
          id: projectId,
          slug: 'alpha',
          workspaceId: 'workspace-id',
          workspace: {
            organizationId: 'organization-id',
            organization: { ownerId: creatorId },
          },
        }),
      },
      projectMember: {
        count: jest.fn().mockResolvedValue(1),
      },
      sprint: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    const accessControl: any = {
      getProjectAccess: jest.fn().mockResolvedValue({ canChange: true }),
    };

    return {
      service: new TasksService(
        prisma,
        accessControl,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      ),
      prisma,
    };
  };

  it('rejects assignees who are not members of the selected project', async () => {
    const { service, prisma } = createService();

    await expect(
      service.create(
        {
          title: 'Prepare campaign',
          projectId,
          statusId: '55555555-5555-4555-8555-555555555555',
          assigneeIds: [memberId, outsiderId],
        },
        creatorId,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.projectMember.count).toHaveBeenCalledWith({
      where: {
        projectId,
        userId: { in: [memberId, outsiderId] },
      },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('TasksService chat source linkage', () => {
  const projectId = '11111111-1111-4111-8111-111111111111';
  const creatorId = '22222222-2222-4222-8222-222222222222';
  const sourceChatMessageId = '33333333-3333-4333-8333-333333333333';

  const createService = () => {
    const createdTask = {
      id: '44444444-4444-4444-8444-444444444444',
      projectId,
      project: {
        workspace: {
          id: 'workspace-id',
          organization: { id: 'organization-id' },
        },
      },
    };
    const tx: any = {
      task: {
        create: jest.fn().mockResolvedValue(createdTask),
      },
    };
    const prisma: any = {
      project: {
        findUnique: jest.fn().mockResolvedValue({
          id: projectId,
          slug: 'alpha',
          workspaceId: 'workspace-id',
          workspace: {
            organizationId: 'organization-id',
            organization: { ownerId: creatorId },
          },
        }),
      },
      projectMember: {
        count: jest.fn().mockResolvedValue(0),
      },
      sprint: {
        findFirst: jest.fn().mockResolvedValue(undefined),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const accessControl: any = {
      getProjectAccess: jest.fn().mockResolvedValue({ canChange: true }),
    };
    const taskRanksService: any = {
      seedForTask: jest.fn().mockResolvedValue(undefined),
    };
    const service = new TasksService(
      prisma,
      accessControl,
      {} as any,
      {} as any,
      taskRanksService,
      {} as any,
    );
    (service as any).getNextTaskNumber = jest.fn().mockResolvedValue({
      taskNumber: 1,
      taskSlug: 'alpha-1',
    });

    return { service, tx };
  };

  it('persists the source chat message id when creating a task from chat', async () => {
    const { service, tx } = createService();

    await service.create(
      {
        title: 'Prepare banner',
        projectId,
        statusId: '55555555-5555-4555-8555-555555555555',
        sourceChatMessageId,
      } as any,
      creatorId,
    );

    expect(tx.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceChatMessageId,
        }),
      }),
    );
  });
});
