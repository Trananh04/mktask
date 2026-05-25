jest.mock('mime', () => ({
  __esModule: true,
  default: { getType: jest.fn() },
  getType: jest.fn(),
}));

import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ChatService } from './chat.service';

describe('ChatService', () => {
  const organizationId = '11111111-1111-4111-8111-111111111111';
  const projectId = '22222222-2222-4222-8222-222222222222';
  const conversationId = '33333333-3333-4333-8333-333333333333';
  const memberId = '44444444-4444-4444-8444-444444444444';
  const viewerId = '55555555-5555-4555-8555-555555555555';
  const teammateId = '66666666-6666-4666-8666-666666666666';
  const outsiderId = '77777777-7777-4777-8777-777777777777';
  const workspaceId = '88888888-8888-4888-8888-888888888888';

  const project = {
      id: projectId,
      name: 'Chat MVP',
      slug: 'chat-mvp',
      workspace: {
      id: workspaceId,
      organizationId,
      organization: {
        id: organizationId,
        archive: false,
        ownerId: '99999999-9999-4999-8999-999999999999',
      },
    },
  };

  const projectConversation = {
    id: conversationId,
    type: 'PROJECT',
    projectId,
    organizationId,
    project,
  };

  const createService = () => {
    const prisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ role: Role.MEMBER }),
      },
      organizationMember: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      workspaceMember: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      workspace: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({
          id: workspaceId,
          organizationId,
          organization: { archive: false },
        }),
      },
      project: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(project),
      },
      projectMember: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
      },
      chatConversation: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
      },
      chatConversationMember: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
      },
      chatConversationReadState: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
      },
      chatMessage: {
        groupBy: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
      },
      chatMessageReaction: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      taskStatus: {
        findFirst: jest.fn(),
      },
    };

    const eventsGateway: any = {
      emitChatMessage: jest.fn(),
      emitChatUnread: jest.fn(),
      emitChatMessageReaction: jest.fn(),
      emitChatMessagePinned: jest.fn(),
      emitNotification: jest.fn(),
    };
    const notificationsService: any = {
      createNotification: jest.fn().mockResolvedValue({
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      }),
    };
    const tasksService: any = {
      create: jest.fn().mockResolvedValue({
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        title: 'Mai làm banner landing page',
      }),
    };

    return {
      prisma,
      eventsGateway,
      notificationsService,
      tasksService,
      service: new ChatService(prisma, eventsGateway, notificationsService, tasksService),
    };
  };

  it('creates the project conversation for a project member', async () => {
    const { service, prisma } = createService();
    prisma.projectMember.findUnique.mockResolvedValue({ role: Role.MEMBER });
    prisma.chatConversation.findFirst.mockResolvedValue(null);
    prisma.chatConversation.create.mockResolvedValue(projectConversation);

    await expect(service.getOrCreateProjectConversation(projectId, memberId)).resolves.toEqual(
      projectConversation,
    );
    expect(prisma.chatConversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'PROJECT',
          organizationId,
          projectId,
          createdById: memberId,
        }),
      }),
    );
  });

  it('automatically prepares project conversations for the global chat list', async () => {
    const { service, prisma } = createService();
    prisma.project.findMany.mockResolvedValue([
      {
        id: projectId,
        workspace: { organizationId },
      },
    ]);
    prisma.chatConversation.upsert.mockResolvedValue(projectConversation);
    prisma.chatConversation.findMany.mockResolvedValue([projectConversation]);

    await expect(service.listConversations(memberId, organizationId)).resolves.toEqual([
      {
        ...projectConversation,
        unreadCount: 0,
      },
    ]);
    expect(prisma.chatConversation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          projectId_type: {
            projectId,
            type: 'PROJECT',
          },
        },
        create: expect.objectContaining({
          projectId,
          organizationId,
          createdById: memberId,
        }),
      }),
    );
  });

  it('adds unread message counts to the conversation list', async () => {
    const { service, prisma } = createService();
    const lastReadAt = new Date('2026-05-22T07:00:00.000Z');
    prisma.chatConversation.findMany.mockResolvedValue([projectConversation]);
    prisma.chatConversationReadState.findMany.mockResolvedValue([
      {
        conversationId,
        lastReadAt,
      },
    ]);
    prisma.chatMessage.groupBy.mockResolvedValue([
      {
        conversationId,
        _count: { _all: 2 },
      },
    ]);

    await expect(service.listConversations(memberId, organizationId)).resolves.toEqual([
      {
        ...projectConversation,
        unreadCount: 2,
      },
    ]);
    expect(prisma.chatMessage.groupBy).toHaveBeenCalledWith({
      by: ['conversationId'],
      where: {
        senderId: { not: memberId },
        OR: [
          {
            conversationId,
            createdAt: { gt: lastReadAt },
          },
        ],
      },
      _count: { _all: true },
    });
  });

  it('summarizes unread conversations for navigation badges', async () => {
    const { service, prisma } = createService();
    const directConversationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    prisma.chatConversation.findMany.mockResolvedValue([
      { id: conversationId },
      { id: directConversationId },
    ]);
    prisma.chatMessage.groupBy.mockResolvedValue([
      {
        conversationId,
        _count: { _all: 3 },
      },
    ]);

    await expect(service.getUnreadSummary(memberId, organizationId)).resolves.toEqual({
      unreadCount: 3,
      conversationCount: 1,
    });
  });

  it('marks a conversation as read for the current user', async () => {
    const { service, prisma } = createService();
    prisma.chatConversation.findUnique.mockResolvedValue(projectConversation);
    prisma.projectMember.findUnique.mockResolvedValue({ role: Role.MEMBER });
    prisma.chatConversationReadState.upsert.mockResolvedValue({
      conversationId,
      userId: memberId,
      lastReadAt: new Date('2026-05-22T08:00:00.000Z'),
    });

    await service.markConversationRead(conversationId, memberId);

    expect(prisma.chatConversationReadState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          conversationId_userId: {
            conversationId,
            userId: memberId,
          },
        },
        update: {
          lastReadAt: expect.any(Date),
        },
      }),
    );
  });

  it('lets viewers read project messages but rejects sending', async () => {
    const { service, prisma } = createService();
    prisma.chatConversation.findUnique.mockResolvedValue(projectConversation);
    prisma.projectMember.findUnique.mockResolvedValue({ role: Role.VIEWER });

    await expect(service.listMessages(conversationId, viewerId)).resolves.toEqual([]);
    await expect(service.sendMessage(conversationId, viewerId, 'hello')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('creates a direct conversation only for users in the same organization', async () => {
    const { service, prisma } = createService();
    prisma.organizationMember.findUnique
      .mockResolvedValueOnce({ userId: memberId, organizationId })
      .mockResolvedValueOnce({ userId: teammateId, organizationId });
    prisma.chatConversation.findFirst.mockResolvedValue(null);
    prisma.chatConversation.create.mockResolvedValue({
      id: conversationId,
      type: 'DIRECT',
      organizationId,
    });

    await service.createDirectConversation(
      { organizationId, participantId: teammateId },
      memberId,
    );

    expect(prisma.chatConversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'DIRECT',
          organizationId,
          members: {
            create: [{ userId: memberId }, { userId: teammateId }],
          },
        }),
      }),
    );

    prisma.organizationMember.findUnique
      .mockResolvedValueOnce({ userId: memberId, organizationId })
      .mockResolvedValueOnce(null);

    await expect(
      service.createDirectConversation({ organizationId, participantId: outsiderId }, memberId),
    ).rejects.toThrow(ForbiddenException);
  });

  it('keeps direct messages private to conversation members', async () => {
    const { service, prisma } = createService();
    prisma.chatConversation.findUnique.mockResolvedValue({
      id: conversationId,
      type: 'DIRECT',
      organizationId,
    });
    prisma.chatConversationMember.findUnique.mockResolvedValue(null);

    await expect(service.listMessages(conversationId, outsiderId)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('persists a message and emits it to the conversation room', async () => {
    const { service, prisma, eventsGateway } = createService();
    const message = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      conversationId,
      senderId: memberId,
      content: 'Ship it',
    };

    prisma.chatConversation.findUnique.mockResolvedValue(projectConversation);
    prisma.projectMember.findUnique.mockResolvedValue({ role: Role.MEMBER });
    prisma.projectMember.findMany.mockResolvedValue([{ userId: teammateId }]);
    prisma.chatMessage.create.mockResolvedValue(message);

    await expect(service.sendMessage(conversationId, memberId, 'Ship it')).resolves.toEqual(
      message,
    );
    expect(eventsGateway.emitChatMessage).toHaveBeenCalledWith(conversationId, message);
    expect(eventsGateway.emitChatUnread).toHaveBeenCalledWith([teammateId], {
      conversationId,
      organizationId,
      message,
    });
  });

  it('creates workspace conversations only for workspace members', async () => {
    const { service, prisma } = createService();
    prisma.workspaceMember.findUnique.mockResolvedValue({ role: Role.MEMBER });
    prisma.chatConversation.findFirst.mockResolvedValue(null);
    prisma.chatConversation.create.mockResolvedValue({
      id: conversationId,
      type: 'WORKSPACE',
      workspaceId,
      organizationId,
    });

    await service.getOrCreateWorkspaceConversation(workspaceId, memberId);

    expect(prisma.chatConversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'WORKSPACE',
          workspaceId,
          organizationId,
          createdById: memberId,
        }),
      }),
    );

    prisma.workspaceMember.findUnique.mockResolvedValue(null);
    await expect(service.getOrCreateWorkspaceConversation(workspaceId, outsiderId)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('supports replies, attachments, and mention notifications when sending messages', async () => {
    const { service, prisma, notificationsService, eventsGateway } = createService();
    const parentMessageId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const message = {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      conversationId,
      senderId: memberId,
      content: '@Lan mai làm banner landing page',
    };

    prisma.chatConversation.findUnique.mockResolvedValue(projectConversation);
    prisma.chatMessage.findUnique.mockResolvedValue({
      id: parentMessageId,
      conversationId,
      conversation: projectConversation,
    });
    prisma.projectMember.findUnique.mockResolvedValue({ role: Role.MEMBER });
    prisma.projectMember.findMany
      .mockResolvedValueOnce([{ userId: teammateId }])
      .mockResolvedValueOnce([{ userId: teammateId }]);
    prisma.chatMessage.create.mockResolvedValue(message);

    await service.sendMessage(conversationId, memberId, '@Lan mai làm banner landing page', {
      parentMessageId,
      mentionedUserIds: [teammateId],
      attachments: [
        {
          fileName: 'brief.png',
          mimeType: 'image/png',
          size: 123,
          url: '/chat/brief.png',
          storageKey: 'chat/brief.png',
        },
      ],
    });

    expect(prisma.chatMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          parentMessageId,
          mentions: { create: [{ userId: teammateId }] },
          attachments: {
            create: [
              expect.objectContaining({
                fileName: 'brief.png',
                projectId,
              }),
            ],
          },
        }),
      }),
    );
    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'MENTION',
        userId: teammateId,
        organizationId,
      }),
    );
    expect(eventsGateway.emitNotification).toHaveBeenCalledWith(
      teammateId,
      expect.objectContaining({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }),
    );
  });

  it('searches messages inside an accessible conversation', async () => {
    const { service, prisma } = createService();
    prisma.chatConversation.findUnique.mockResolvedValue(projectConversation);
    prisma.projectMember.findUnique.mockResolvedValue({ role: Role.MEMBER });
    prisma.chatMessage.findMany.mockResolvedValue([
      { id: 'message-id', conversationId, content: 'landing page banner' },
    ]);

    await service.searchMessages(conversationId, memberId, { query: 'banner' });

    expect(prisma.chatMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          conversationId,
          content: { contains: 'banner', mode: 'insensitive' },
        }),
      }),
    );
  });

  it('toggles heart reactions per user and emits the updated message', async () => {
    const { service, prisma, eventsGateway } = createService();
    const messageId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const updatedMessage = { id: messageId, conversationId, reactions: [{ type: 'HEART' }] };
    prisma.chatConversation.findUnique.mockResolvedValue(projectConversation);
    prisma.chatMessage.findUnique.mockResolvedValue({
      id: messageId,
      conversationId,
      conversation: projectConversation,
    });
    prisma.projectMember.findUnique.mockResolvedValue({ role: Role.MEMBER });
    prisma.chatMessageReaction.findUnique.mockResolvedValue(null);
    prisma.chatMessageReaction.create.mockResolvedValue({
      messageId,
      userId: memberId,
      type: 'HEART',
    });
    prisma.chatMessage.findUnique.mockResolvedValueOnce({
      id: messageId,
      conversationId,
      conversation: projectConversation,
    });
    prisma.chatMessage.findUnique.mockResolvedValueOnce(updatedMessage);

    await expect(service.toggleReaction(messageId, memberId, 'HEART')).resolves.toEqual(
      updatedMessage,
    );
    expect(eventsGateway.emitChatMessageReaction).toHaveBeenCalledWith(
      conversationId,
      updatedMessage,
    );
  });

  it('pins a message in a project conversation', async () => {
    const { service, prisma, eventsGateway } = createService();
    const messageId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const updatedMessage = { id: messageId, conversationId, isPinned: true };
    prisma.chatConversation.findUnique.mockResolvedValue(projectConversation);
    prisma.chatMessage.findUnique.mockResolvedValue({
      id: messageId,
      conversationId,
      isPinned: false,
      conversation: projectConversation,
    });
    prisma.projectMember.findUnique.mockResolvedValue({ role: Role.MEMBER });
    prisma.chatMessage.update.mockResolvedValue(updatedMessage);

    await service.togglePin(messageId, memberId);

    expect(prisma.chatMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isPinned: true,
          pinnedById: memberId,
        }),
      }),
    );
    expect(eventsGateway.emitChatMessagePinned).toHaveBeenCalledWith(conversationId, updatedMessage);
  });

  it('creates a project task from a chat message with inferred title and due date', async () => {
    const { service, prisma, tasksService } = createService();
    const messageId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    prisma.chatConversation.findUnique.mockResolvedValue(projectConversation);
    prisma.chatMessage.findUnique.mockResolvedValue({
      id: messageId,
      conversationId,
      content: '@Lan mai làm banner landing page',
      mentions: [{ userId: teammateId }],
      conversation: projectConversation,
    });
    prisma.projectMember.findUnique.mockResolvedValue({ role: Role.MEMBER });
    prisma.project.findUnique
      .mockResolvedValueOnce(project)
      .mockResolvedValueOnce({
        workflow: {
          statuses: [{ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' }],
        },
      });

    await service.createTaskFromMessage(messageId, memberId, {});

    expect(tasksService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Mai làm banner landing page',
        projectId,
        statusId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        assigneeIds: [teammateId],
        sourceChatMessageId: messageId,
      }),
      memberId,
    );
  });
});
