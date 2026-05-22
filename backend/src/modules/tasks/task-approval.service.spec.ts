import { ForbiddenException } from '@nestjs/common';
import {
  TaskDailyReportStatus,
  TaskDailyReportType,
  TaskStatusChangeRequestStatus,
} from '@prisma/client';
import { TasksService } from './tasks.service';

jest.mock('../storage/storage.service', () => ({
  StorageService: jest.fn(),
}));

describe('TasksService approvals and daily reports', () => {
  const taskId = '11111111-1111-4111-8111-111111111111';
  const userId = '22222222-2222-4222-8222-222222222222';
  const managerId = '33333333-3333-4333-8333-333333333333';
  const orgId = '44444444-4444-4444-8444-444444444444';
  const statusId = '55555555-5555-4555-8555-555555555555';

  const taskContext = {
    id: taskId,
    title: 'Prepare sprint report',
    statusId: '66666666-6666-4666-8666-666666666666',
    status: { id: '66666666-6666-4666-8666-666666666666', name: 'Todo', category: 'TODO' },
    project: {
      id: '77777777-7777-4777-8777-777777777777',
      name: 'Internal',
      workflowId: '88888888-8888-4888-8888-888888888888',
      workspace: { organizationId: orgId },
    },
    assignees: [{ userId }],
    reporters: [],
  };

  const createService = () => {
    const prisma: any = {
      task: {
        findUnique: jest.fn().mockResolvedValue(taskContext),
        update: jest.fn().mockResolvedValue({ id: taskId }),
      },
      project: {
        findUnique: jest.fn().mockResolvedValue({
          createdBy: managerId,
          members: [],
        }),
      },
      taskStatus: {
        findFirst: jest.fn().mockResolvedValue({ id: statusId, name: 'Done' }),
        findUnique: jest.fn().mockResolvedValue({ category: 'DONE' }),
      },
      taskStatusChangeRequest: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      taskDailyReport: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ role: 'MANAGER' }),
        findMany: jest.fn().mockResolvedValue([{ id: managerId }]),
      },
      organizationMember: {
        findUnique: jest.fn().mockResolvedValue({ role: 'MANAGER' }),
        findMany: jest.fn().mockResolvedValue([{ userId: managerId }]),
      },
      $transaction: jest.fn(),
    };
    const accessControl: any = {
      getTaskAccess: jest.fn().mockResolvedValue({
        canChange: true,
        isElevated: false,
        isSuperAdmin: false,
        role: 'MEMBER',
        task: { id: taskId },
      }),
    };
    const notifications: any = {
      createNotification: jest.fn().mockResolvedValue({ id: 'notification-id' }),
    };

    const service = new TasksService(
      prisma,
      accessControl,
      {} as any,
      {} as any,
      {} as any,
      notifications,
    );

    return { service, prisma, accessControl, notifications };
  };

  it('creates a pending status change request and notifies managers', async () => {
    const { service, prisma, notifications } = createService();
    const expectedRequest = { id: 'request-id', taskId, requestedStatusId: statusId };
    prisma.taskStatusChangeRequest.create.mockResolvedValue(expectedRequest);

    const result = await service.requestTaskStatusChange(
      taskId,
      { statusId, note: 'Em đã xong phần này' },
      userId,
    );

    expect(result).toEqual(expectedRequest);
    expect(prisma.taskStatusChangeRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          taskId,
          requestedStatusId: statusId,
          requestedById: userId,
        }),
      }),
    );
    expect(notifications.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: managerId,
        organizationId: orgId,
        entityType: 'TaskStatusChangeRequest',
      }),
    );
  });

  it('updates an existing pending status change request instead of creating a duplicate', async () => {
    const { service, prisma } = createService();
    prisma.taskStatusChangeRequest.findFirst.mockResolvedValue({ id: 'existing-request' });
    prisma.taskStatusChangeRequest.update.mockResolvedValue({ id: 'existing-request' });

    await service.requestTaskStatusChange(taskId, { statusId }, userId);

    expect(prisma.taskStatusChangeRequest.create).not.toHaveBeenCalled();
    expect(prisma.taskStatusChangeRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'existing-request' },
        data: expect.objectContaining({ requestedStatusId: statusId }),
      }),
    );
  });

  it('notifies owner members when a project has no creator id', async () => {
    const { service, prisma, notifications } = createService();
    prisma.project.findUnique.mockResolvedValue({
      createdBy: null,
      members: [{ userId: managerId }],
    });
    prisma.taskStatusChangeRequest.create.mockResolvedValue({ id: 'request-id' });

    await service.requestTaskStatusChange(taskId, { statusId }, userId);

    expect(notifications.createNotification).toHaveBeenCalledTimes(1);
    expect(notifications.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: managerId,
        entityType: 'TaskStatusChangeRequest',
      }),
    );
  });

  it('approves a status change request and updates the task status', async () => {
    const { service, prisma, accessControl } = createService();
    const request = {
      id: 'request-id',
      taskId,
      requestedStatusId: statusId,
      status: TaskStatusChangeRequestStatus.PENDING,
    };
    prisma.taskStatusChangeRequest.findUnique.mockResolvedValue(request);
    accessControl.getTaskAccess.mockResolvedValue({
      canChange: true,
      isElevated: true,
      isSuperAdmin: false,
      role: 'MANAGER',
      task: { id: taskId },
    });
    prisma.$transaction.mockResolvedValue([{ ...request, status: 'APPROVED' }, { id: taskId }]);

    await service.reviewTaskStatusChangeRequest(
      'request-id',
      { decision: 'APPROVED', note: 'OK' },
      managerId,
    );

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Array));
    expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(2);
    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: taskId },
        data: expect.objectContaining({
          statusId,
          updatedBy: managerId,
        }),
      }),
    );
  });

  it('submits a daily report for a task and notifies managers', async () => {
    const { service, prisma, notifications } = createService();
    prisma.taskDailyReport.upsert.mockResolvedValue({ id: 'report-id', taskId });

    const result = await service.createTaskDailyReport(
      taskId,
      {
        type: TaskDailyReportType.START_OF_DAY,
        reportDate: '2026-05-20',
        content: 'Hôm nay xử lý API duyệt task',
        progressPercent: 40,
      },
      userId,
    );

    expect(result).toEqual({ id: 'report-id', taskId });
    expect(prisma.taskDailyReport.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          taskId,
          reporterId: userId,
          type: TaskDailyReportType.START_OF_DAY,
        }),
      }),
    );
    expect(notifications.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'TaskDailyReport',
        organizationId: orgId,
      }),
    );
  });

  it('blocks non-managers from listing daily reports', async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue({ role: 'MEMBER' });
    prisma.organizationMember.findUnique.mockResolvedValue({ role: 'MEMBER' });

    await expect(
      service.listTaskDailyReports(userId, {
        organizationId: orgId,
        status: TaskDailyReportStatus.SUBMITTED,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lists daily reports with project and workspace metadata for task links', async () => {
    const { service, prisma } = createService();
    const expectedReport = {
      id: 'report-id',
      taskId,
      task: {
        id: taskId,
        title: 'Prepare sprint report',
        slug: 'prepare-sprint-report',
        project: {
          id: taskContext.project.id,
          name: 'Internal',
          slug: 'internal',
          workspace: {
            id: '99999999-9999-4999-8999-999999999999',
            name: 'Operations',
            slug: 'operations',
            organizationId: orgId,
          },
        },
      },
    };
    prisma.taskDailyReport.findMany.mockResolvedValue([expectedReport]);

    const result = await service.listTaskDailyReports(managerId, {
      organizationId: orgId,
      date: '2026-05-21',
    });

    expect(result).toEqual([expectedReport]);
    expect(prisma.taskDailyReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          task: expect.objectContaining({
            select: expect.objectContaining({
              slug: true,
              project: expect.objectContaining({
                select: expect.objectContaining({
                  name: true,
                  slug: true,
                  workspace: expect.objectContaining({
                    select: expect.objectContaining({
                      id: true,
                      name: true,
                      slug: true,
                      organizationId: true,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    );
  });

  it('limits organization managers to daily reports in projects they own', async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue({ role: 'MEMBER' });
    prisma.organizationMember.findUnique.mockResolvedValue({ role: 'MANAGER' });
    prisma.taskDailyReport.findMany.mockResolvedValue([]);

    await service.listTaskDailyReports(managerId, {
      organizationId: orgId,
      date: '2026-05-21',
    });

    expect(prisma.taskDailyReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          task: expect.objectContaining({
            project: expect.objectContaining({
              OR: [
                { createdBy: managerId },
                { members: { some: { userId: managerId, role: 'OWNER' } } },
              ],
            }),
          }),
        }),
      }),
    );
  });

  it('lists status change requests with project and workspace metadata for task links', async () => {
    const { service, prisma } = createService();
    prisma.taskStatusChangeRequest.findMany.mockResolvedValue([]);

    await service.listTaskStatusChangeRequests(managerId, {
      organizationId: orgId,
      status: TaskStatusChangeRequestStatus.PENDING,
    });

    expect(prisma.taskStatusChangeRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          task: expect.objectContaining({
            select: expect.objectContaining({
              slug: true,
              project: expect.objectContaining({
                select: expect.objectContaining({
                  name: true,
                  slug: true,
                  workspace: expect.objectContaining({
                    select: expect.objectContaining({
                      id: true,
                      name: true,
                      slug: true,
                      organizationId: true,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    );
  });
});
