import { NotificationPriority, NotificationType, Role } from '@prisma/client';
import { NotificationsService } from './notifications.service';

describe('NotificationsService task deadline reminders', () => {
  const taskId = '11111111-1111-4111-8111-111111111111';
  const assigneeId = '22222222-2222-4222-8222-222222222222';
  const projectManagerId = '33333333-3333-4333-8333-333333333333';
  const workspaceManagerId = '44444444-4444-4444-8444-444444444444';
  const organizationManagerId = '55555555-5555-4555-8555-555555555555';

  const task = {
    id: taskId,
    title: 'Finish acceptance review',
    slug: 'finish-acceptance-review',
    dueDate: new Date('2026-05-23T08:00:00.000Z'),
    assignees: [{ userId: assigneeId }],
    project: {
      slug: 'qa-project',
      members: [
        { userId: projectManagerId, role: Role.MANAGER },
        { userId: assigneeId, role: Role.MEMBER },
      ],
      workspace: {
        slug: 'delivery',
        organizationId: '66666666-6666-4666-8666-666666666666',
        members: [{ userId: workspaceManagerId, role: Role.OWNER }],
        organization: {
          ownerId: workspaceManagerId,
          members: [
            { userId: organizationManagerId, role: Role.MANAGER },
            { userId: projectManagerId, role: Role.MEMBER },
          ],
        },
      },
    },
  };

  const createService = () => {
    const prisma: any = {
      task: {
        findUnique: jest.fn().mockResolvedValue(task),
      },
      notification: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
      },
    };

    return { service: new NotificationsService(prisma), prisma };
  };

  it('notifies assignees and managers about incomplete tasks due soon without duplicate recipients', async () => {
    const { service, prisma } = createService();

    await service.notifyTaskDueSoon(taskId);

    expect(prisma.notification.create).toHaveBeenCalledTimes(4);
    expect(prisma.notification.create.mock.calls.map(([call]) => call.data.userId)).toEqual(
      expect.arrayContaining([
        assigneeId,
        projectManagerId,
        workspaceManagerId,
        organizationManagerId,
      ]),
    );
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Task Due Soon',
          type: NotificationType.TASK_DUE_SOON,
          priority: NotificationPriority.HIGH,
          entityId: taskId,
        }),
      }),
    );
  });

  it('creates urgent overdue reminders for assignees and managers', async () => {
    const { service, prisma } = createService();

    await service.notifyTaskOverdue(taskId);

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Task Overdue',
          message: expect.stringContaining('not completed'),
          type: NotificationType.TASK_DUE_SOON,
          priority: NotificationPriority.URGENT,
          entityId: taskId,
        }),
      }),
    );
  });
});
