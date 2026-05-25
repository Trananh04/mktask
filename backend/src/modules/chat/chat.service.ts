/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ChatConversationType,
  NotificationPriority,
  NotificationType,
  Prisma,
  Role,
} from '@prisma/client';
import { EventsGateway } from '../../gateway/events.gateway';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TasksService } from '../tasks/tasks.service';
import { CreateDirectConversationDto } from './dto/create-direct-conversation.dto';
import { ChatAttachmentInputDto } from './dto/send-chat-message.dto';

const WORKSPACE_CONVERSATION = 'WORKSPACE' as ChatConversationType;

const messageInclude = {
  sender: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      avatar: true,
    },
  },
  parentMessage: {
    select: {
      id: true,
      content: true,
      senderId: true,
      sender: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatar: true,
        },
      },
    },
  },
  mentions: {
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatar: true,
        },
      },
    },
  },
  reactions: {
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatar: true,
        },
      },
    },
  },
  attachments: true,
  pinnedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      avatar: true,
    },
  },
} as const;

const conversationInclude = {
  members: {
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatar: true,
        },
      },
    },
  },
  project: {
    select: {
      id: true,
      name: true,
      slug: true,
      avatar: true,
      color: true,
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          organizationId: true,
        },
      },
    },
  },
  workspace: {
    select: {
      id: true,
      name: true,
      slug: true,
      avatar: true,
      color: true,
      organizationId: true,
    },
  },
  messages: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    include: messageInclude as any,
  },
} as const;

type AccessMode = 'read' | 'send';
type SendMessageOptions = {
  parentMessageId?: string;
  mentionedUserIds?: string[];
  attachments?: ChatAttachmentInputDto[];
};
type SearchMessagesOptions = {
  query?: string;
  senderId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
};

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
    private readonly notificationsService: NotificationsService,
    private readonly tasksService: TasksService,
  ) {}

  async listConversations(userId: string, organizationId?: string) {
    await Promise.all([
      this.prepareProjectConversations(userId, organizationId),
      this.prepareWorkspaceConversations(userId, organizationId),
    ]);

    const conversations = await this.prisma.chatConversation.findMany({
      where: {
        ...(organizationId ? { organizationId } : {}),
        OR: [
          {
            type: ChatConversationType.DIRECT,
            members: { some: { userId } },
          },
          {
            type: ChatConversationType.PROJECT,
            project: { archive: false, members: { some: { userId } } },
          },
          {
            type: WORKSPACE_CONVERSATION,
            workspace: { archive: false, members: { some: { userId } } },
          },
        ],
      } as any,
      include: conversationInclude as any,
      orderBy: { updatedAt: 'desc' },
    });

    return this.withUnreadCounts(conversations, userId);
  }

  async getUnreadSummary(userId: string, organizationId?: string) {
    const conversations = await this.prisma.chatConversation.findMany({
      where: {
        ...(organizationId ? { organizationId } : {}),
        OR: [
          {
            type: ChatConversationType.DIRECT,
            members: { some: { userId } },
          },
          {
            type: ChatConversationType.PROJECT,
            project: { archive: false, members: { some: { userId } } },
          },
          {
            type: WORKSPACE_CONVERSATION,
            workspace: { archive: false, members: { some: { userId } } },
          },
        ],
      } as any,
      select: { id: true },
    });
    const withCounts = await this.withUnreadCounts(conversations, userId);

    return {
      unreadCount: withCounts.reduce((total, conversation) => total + conversation.unreadCount, 0),
      conversationCount: withCounts.filter((conversation) => conversation.unreadCount > 0).length,
    };
  }

  private async prepareProjectConversations(userId: string, organizationId?: string) {
    const projects = await this.prisma.project.findMany({
      where: {
        members: { some: { userId } },
        archive: false,
        ...(organizationId ? { workspace: { organizationId } } : {}),
      },
      select: {
        id: true,
        workspace: {
          select: {
            organizationId: true,
          },
        },
      },
    });

    await Promise.all(
      projects.map((project) =>
        this.prisma.chatConversation.upsert({
          where: {
            projectId_type: {
              projectId: project.id,
              type: ChatConversationType.PROJECT,
            },
          },
          update: {},
          create: {
            type: ChatConversationType.PROJECT,
            organizationId: project.workspace.organizationId,
            projectId: project.id,
            createdById: userId,
          },
          include: conversationInclude as any,
        }),
      ),
    );
  }

  private async prepareWorkspaceConversations(userId: string, organizationId?: string) {
    const workspaces = await this.prisma.workspace.findMany({
      where: {
        members: { some: { userId } },
        archive: false,
        ...(organizationId ? { organizationId } : {}),
      },
      select: {
        id: true,
        organizationId: true,
      },
    });

    await Promise.all(
      workspaces.map((workspace) =>
        this.prisma.chatConversation.upsert({
          where: {
            workspaceId_type: {
              workspaceId: workspace.id,
              type: WORKSPACE_CONVERSATION,
            },
          },
          update: {},
          create: {
            type: WORKSPACE_CONVERSATION,
            organizationId: workspace.organizationId,
            workspaceId: workspace.id,
            createdById: userId,
          },
          include: conversationInclude as any,
        } as any),
      ),
    );
  }

  async listContacts(organizationId: string, userId: string) {
    await this.assertOrganizationMember(organizationId, userId);

    return this.prisma.organizationMember.findMany({
      where: {
        organizationId,
        userId: { not: userId },
      },
      select: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
      },
      orderBy: [{ user: { firstName: 'asc' } }, { user: { lastName: 'asc' } }],
    });
  }

  async getOrCreateProjectConversation(projectId: string, userId: string) {
    const project = await this.assertProjectAccess(projectId, userId, 'read');
    const existing = await this.prisma.chatConversation.findFirst({
      where: {
        projectId,
        type: ChatConversationType.PROJECT,
      },
      include: conversationInclude as any,
    });

    if (existing) return existing;

    return this.prisma.chatConversation.create({
      data: {
        type: ChatConversationType.PROJECT,
        organizationId: project.workspace.organizationId,
        projectId,
        createdById: userId,
      },
      include: conversationInclude as any,
    });
  }

  async getOrCreateWorkspaceConversation(workspaceId: string, userId: string) {
    const workspace = await this.assertWorkspaceAccess(workspaceId, userId, 'read');
    const existing = await this.prisma.chatConversation.findFirst({
      where: {
        workspaceId,
        type: WORKSPACE_CONVERSATION,
      } as any,
      include: conversationInclude as any,
    });

    if (existing) return existing;

    return this.prisma.chatConversation.create({
      data: {
        type: WORKSPACE_CONVERSATION,
        organizationId: workspace.organizationId,
        workspaceId,
        createdById: userId,
      } as any,
      include: conversationInclude as any,
    });
  }

  async createDirectConversation(dto: CreateDirectConversationDto, userId: string) {
    if (dto.participantId === userId) {
      throw new BadRequestException('Choose another participant for a direct conversation');
    }

    await Promise.all([
      this.assertOrganizationMember(dto.organizationId, userId),
      this.assertOrganizationMember(dto.organizationId, dto.participantId),
    ]);

    const existing = await this.prisma.chatConversation.findFirst({
      where: {
        type: ChatConversationType.DIRECT,
        organizationId: dto.organizationId,
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: dto.participantId } } },
        ],
      },
      include: conversationInclude as any,
    });

    if (existing) return existing;

    return this.prisma.chatConversation.create({
      data: {
        type: ChatConversationType.DIRECT,
        organizationId: dto.organizationId,
        createdById: userId,
        members: {
          create: [{ userId }, { userId: dto.participantId }],
        },
      },
      include: conversationInclude as any,
    });
  }

  async listMessages(conversationId: string, userId: string, limit = 60, cursor?: string) {
    await this.assertConversationAccess(conversationId, userId, 'read');
    const messages = await this.prisma.chatMessage.findMany({
      where: { conversationId },
      include: messageInclude as any,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    return messages.reverse();
  }

  async searchMessages(conversationId: string, userId: string, options: SearchMessagesOptions) {
    await this.assertConversationAccess(conversationId, userId, 'read');
    const where: Prisma.ChatMessageWhereInput = { conversationId };

    if (options.query?.trim()) {
      where.content = { contains: options.query.trim(), mode: 'insensitive' };
    }
    if (options.senderId) {
      where.senderId = options.senderId;
    }
    if (options.from || options.to) {
      where.createdAt = {
        ...(options.from ? { gte: options.from } : {}),
        ...(options.to ? { lte: options.to } : {}),
      };
    }

    const messages = await this.prisma.chatMessage.findMany({
      where,
      include: messageInclude as any,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(options.limit || 30, 1), 100),
    });

    return messages.reverse();
  }

  async markConversationRead(conversationId: string, userId: string) {
    await this.assertConversationAccess(conversationId, userId, 'read');

    return this.prisma.chatConversationReadState.upsert({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      update: {
        lastReadAt: new Date(),
      },
      create: {
        conversationId,
        userId,
      },
    });
  }

  async sendMessage(
    conversationId: string,
    userId: string,
    rawContent: string,
    options: SendMessageOptions = {},
  ) {
    const content = rawContent.trim();
    if (!content) {
      throw new BadRequestException('Message content is required');
    }

    const conversation = await this.assertConversationAccess(conversationId, userId, 'send');
    if (options.parentMessageId) {
      await this.assertParentMessage(conversationId, options.parentMessageId);
    }
    const mentionedUserIds = await this.filterMentionedUserIds(conversation, userId, [
      ...new Set(options.mentionedUserIds || []),
    ]);
    const attachments = this.normalizeAttachments(conversation, options.attachments || []);
    const message = await this.prisma.chatMessage.create({
      data: {
        conversationId,
        senderId: userId,
        content,
        ...(options.parentMessageId ? { parentMessageId: options.parentMessageId } : {}),
        ...(mentionedUserIds.length > 0
          ? {
              mentions: {
                create: mentionedUserIds.map((mentionedId) => ({ userId: mentionedId })),
              },
            }
          : {}),
        ...(attachments.length > 0 ? { attachments: { create: attachments } } : {}),
      } as any,
      include: messageInclude as any,
    });

    await this.prisma.chatConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    this.eventsGateway.emitChatMessage(conversationId, message);
    const recipientIds = await this.getConversationRecipientIds(conversation, userId);
    if (recipientIds.length > 0) {
      this.eventsGateway.emitChatUnread(recipientIds, {
        conversationId,
        organizationId: conversation.organizationId,
        message,
      });
    }
    await this.createMentionNotifications(conversation, message, userId, mentionedUserIds);
    return message;
  }

  async toggleReaction(messageId: string, userId: string, type: string) {
    const message = await this.getMessageForAccess(messageId, userId, 'read');
    const reactionClient = (this.prisma as any).chatMessageReaction;
    const where = {
      messageId_userId_type: {
        messageId,
        userId,
        type,
      },
    };
    const existing = await reactionClient.findUnique({ where });

    if (existing) {
      await reactionClient.delete({ where });
    } else {
      await reactionClient.create({
        data: {
          messageId,
          userId,
          type,
        },
      });
    }

    const updatedMessage = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: messageInclude as any,
    });

    this.eventsGateway.emitChatMessageReaction(message.conversationId, updatedMessage);
    return updatedMessage;
  }

  async togglePin(messageId: string, userId: string) {
    const message = await this.getMessageForAccess(messageId, userId, 'send');
    const nextPinnedState = !message.isPinned;
    const updatedMessage = await this.prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        isPinned: nextPinnedState,
        pinnedAt: nextPinnedState ? new Date() : null,
        pinnedById: nextPinnedState ? userId : null,
      } as any,
      include: messageInclude as any,
    });

    this.eventsGateway.emitChatMessagePinned(message.conversationId, updatedMessage);
    return updatedMessage;
  }

  async getReadReceipts(conversationId: string, userId: string) {
    await this.assertConversationAccess(conversationId, userId, 'read');

    return this.prisma.chatConversationReadState.findMany({
      where: { conversationId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
      },
      orderBy: { lastReadAt: 'desc' },
    });
  }

  async createTaskFromMessage(
    messageId: string,
    userId: string,
    input: { title?: string; dueDate?: string; assigneeIds?: string[] },
  ) {
    const message = await this.getMessageForAccess(messageId, userId, 'send');
    if (
      message.conversation.type !== ChatConversationType.PROJECT ||
      !message.conversation.projectId
    ) {
      throw new BadRequestException('Tasks can only be created from project chat messages');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: message.conversation.projectId },
      select: {
        workflow: {
          select: {
            statuses: {
              where: { deletedAt: null },
              orderBy: [{ isDefault: 'desc' }, { position: 'asc' }],
              take: 1,
              select: { id: true },
            },
          },
        },
      },
    });
    const status = project?.workflow?.statuses[0];

    if (!status) {
      throw new BadRequestException('Project does not have an available task status');
    }

    const assigneeIds = input.assigneeIds?.length
      ? input.assigneeIds
      : (message.mentions || []).map((mention: { userId: string }) => mention.userId);
    const dueDate = input.dueDate || this.inferDueDate(message.content);

    return this.tasksService.create(
      {
        title: input.title?.trim() || this.inferTaskTitle(message.content),
        description: `Tạo từ tin nhắn chat: ${message.content}`,
        projectId: message.conversation.projectId,
        statusId: status.id,
        ...(assigneeIds.length > 0 ? { assigneeIds } : {}),
        ...(dueDate ? { dueDate } : {}),
        sourceChatMessageId: messageId,
      },
      userId,
    );
  }

  private async getMessageForAccess(messageId: string, userId: string, mode: AccessMode) {
    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: {
        conversation: {
          include: {
            project: {
              select: {
                id: true,
                workspace: {
                  select: {
                    organizationId: true,
                  },
                },
              },
            },
            workspace: {
              select: {
                id: true,
                organizationId: true,
              },
            },
          },
        },
        mentions: {
          select: {
            userId: true,
          },
        },
      } as any,
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    await this.assertConversationAccess(message.conversationId, userId, mode);
    return message as any;
  }

  private inferTaskTitle(content: string) {
    const title =
      content.replace(/@\S+/g, '').replace(/\s+/g, ' ').trim().slice(0, 200) ||
      content.trim().slice(0, 200);

    return title.charAt(0).toUpperCase() + title.slice(1);
  }

  private inferDueDate(content: string) {
    const normalized = content.toLowerCase();
    const dueDate = new Date();

    if (/\b(hôm nay|hom nay)\b/i.test(normalized)) {
      return dueDate.toISOString();
    }

    if (/\b(ngày mai|ngay mai|mai)\b/i.test(normalized)) {
      dueDate.setDate(dueDate.getDate() + 1);
      return dueDate.toISOString();
    }

    const explicitDate = normalized.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?\b/);
    if (!explicitDate) return undefined;

    const day = Number(explicitDate[1]);
    const month = Number(explicitDate[2]) - 1;
    const year = explicitDate[3] ? Number(explicitDate[3]) : dueDate.getFullYear();
    const parsedDate = new Date(year, month, day);

    return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate.toISOString();
  }

  private async withUnreadCounts<T extends { id: string }>(conversations: T[], userId: string) {
    if (conversations.length === 0) {
      return conversations.map((conversation) => ({ ...conversation, unreadCount: 0 }));
    }

    const readStates: Array<{ conversationId: string; lastReadAt: Date }> =
      await this.prisma.chatConversationReadState.findMany({
        where: {
          userId,
          conversationId: { in: conversations.map((conversation) => conversation.id) },
        },
        select: {
          conversationId: true,
          lastReadAt: true,
        },
      });
    const lastReadAtByConversation = new Map<string, Date>(
      readStates.map((readState) => [readState.conversationId, readState.lastReadAt]),
    );

    const unreadGroups = await this.prisma.chatMessage.groupBy({
      by: ['conversationId'],
      where: {
        senderId: { not: userId },
        OR: conversations.map((conversation) => {
          const lastReadAt = lastReadAtByConversation.get(conversation.id);

          return {
            conversationId: conversation.id,
            ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
          };
        }),
      },
      _count: { _all: true },
    });
    const unreadCountByConversation = new Map(
      unreadGroups.map((group) => [group.conversationId, group._count._all]),
    );

    return conversations.map((conversation) => ({
      ...conversation,
      unreadCount: unreadCountByConversation.get(conversation.id) || 0,
    }));
  }

  private async getConversationRecipientIds(
    conversation: {
      id: string;
      type: ChatConversationType;
      projectId: string | null;
      workspaceId?: string | null;
    },
    senderId: string,
  ) {
    if (conversation.type === ChatConversationType.DIRECT) {
      const members = await this.prisma.chatConversationMember.findMany({
        where: {
          conversationId: conversation.id,
          userId: { not: senderId },
        },
        select: { userId: true },
      });
      return members.map((member) => member.userId);
    }

    if (conversation.type === WORKSPACE_CONVERSATION) {
      if (!conversation.workspaceId) return [];

      const members = await this.prisma.workspaceMember.findMany({
        where: {
          workspaceId: conversation.workspaceId,
          userId: { not: senderId },
        },
        select: { userId: true },
      });
      return members.map((member) => member.userId);
    }

    if (!conversation.projectId) {
      return [];
    }

    const members = await this.prisma.projectMember.findMany({
      where: {
        projectId: conversation.projectId,
        userId: { not: senderId },
      },
      select: { userId: true },
    });
    return members.map((member) => member.userId);
  }

  private async assertConversationAccess(conversationId: string, userId: string, mode: AccessMode) {
    const conversation = (await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
      include: {
        project: {
          select: {
            id: true,
            workspace: {
              select: {
                organizationId: true,
              },
            },
          },
        },
        workspace: {
          select: {
            id: true,
            organizationId: true,
          },
        },
      },
    })) as any;

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.type === ChatConversationType.DIRECT) {
      const member = await this.prisma.chatConversationMember.findUnique({
        where: { conversationId_userId: { conversationId, userId } },
        select: { userId: true },
      });
      if (!member) {
        throw new ForbiddenException('Not a member of this direct conversation');
      }
      return conversation;
    }

    if (conversation.type === WORKSPACE_CONVERSATION) {
      if (!conversation.workspaceId) {
        throw new ForbiddenException('Conversation scope is invalid');
      }

      await this.assertWorkspaceAccess(conversation.workspaceId, userId, mode);
      return conversation;
    }

    if (!conversation.projectId) {
      throw new ForbiddenException('Conversation scope is invalid');
    }

    await this.assertProjectAccess(conversation.projectId, userId, mode);
    return conversation;
  }

  private async assertWorkspaceAccess(workspaceId: string, userId: string, mode: AccessMode) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        organizationId: true,
        archive: true,
        organization: {
          select: {
            archive: true,
          },
        },
      },
    });

    if (!workspace || workspace.archive) {
      throw new NotFoundException('Workspace not found');
    }

    const actor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (actor?.role === Role.SUPER_ADMIN) {
      return workspace;
    }

    const member = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
      select: { role: true },
    });

    if (!member) {
      throw new ForbiddenException('Not a member of this workspace conversation');
    }

    if (mode === 'send' && (member.role === Role.VIEWER || workspace.organization.archive)) {
      throw new ForbiddenException('This workspace conversation is read-only');
    }

    return workspace;
  }

  private async assertParentMessage(conversationId: string, parentMessageId: string) {
    const parent = await this.prisma.chatMessage.findUnique({
      where: { id: parentMessageId },
      select: { id: true, conversationId: true },
    });

    if (!parent || parent.conversationId !== conversationId) {
      throw new BadRequestException('Reply message must belong to the same conversation');
    }
  }

  private normalizeAttachments(
    conversation: { projectId: string | null; workspaceId?: string | null },
    attachments: ChatAttachmentInputDto[],
  ) {
    return attachments.map((attachment) => ({
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      url: attachment.url,
      storageKey: attachment.storageKey,
      projectId: conversation.projectId || undefined,
      workspaceId: conversation.workspaceId || undefined,
    }));
  }

  private async filterMentionedUserIds(
    conversation: {
      id: string;
      type: ChatConversationType;
      projectId: string | null;
      workspaceId?: string | null;
    },
    senderId: string,
    mentionedUserIds: string[],
  ) {
    const requestedIds = mentionedUserIds.filter((id) => id !== senderId);
    if (requestedIds.length === 0) return [];

    if (conversation.type === ChatConversationType.DIRECT) {
      const members = await this.prisma.chatConversationMember.findMany({
        where: {
          conversationId: conversation.id,
          userId: { in: requestedIds },
        },
        select: { userId: true },
      });
      return members.map((member) => member.userId);
    }

    if (conversation.type === WORKSPACE_CONVERSATION) {
      const members = await this.prisma.workspaceMember.findMany({
        where: {
          workspaceId: conversation.workspaceId || '',
          userId: { in: requestedIds },
        },
        select: { userId: true },
      });
      return members.map((member) => member.userId);
    }

    const members = await this.prisma.projectMember.findMany({
      where: {
        projectId: conversation.projectId || '',
        userId: { in: requestedIds },
      },
      select: { userId: true },
    });
    return members.map((member) => member.userId);
  }

  private async createMentionNotifications(
    conversation: { id: string; organizationId: string; projectId: string | null },
    message: { id: string; content: string },
    senderId: string,
    mentionedUserIds: string[],
  ) {
    await Promise.all(
      mentionedUserIds.map(async (mentionedUserId) => {
        const notification = await this.notificationsService.createNotification({
          title: 'Bạn được nhắc trong chat',
          message: message.content.slice(0, 180),
          type: NotificationType.MENTION,
          priority: NotificationPriority.HIGH,
          userId: mentionedUserId,
          organizationId: conversation.organizationId,
          entityType: 'ChatMessage',
          entityId: message.id,
          actionUrl: `/chat?conversationId=${conversation.id}`,
          createdBy: senderId,
        });

        this.eventsGateway.emitNotification(mentionedUserId, notification);
      }),
    );
  }

  private async assertProjectAccess(projectId: string, userId: string, mode: AccessMode) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        slug: true,
        workspace: {
          select: {
            id: true,
            organizationId: true,
            organization: {
              select: {
                archive: true,
              },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const actor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (actor?.role === Role.SUPER_ADMIN) {
      return project;
    }

    const member = await this.prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
      select: { role: true },
    });

    if (!member) {
      throw new ForbiddenException('Not a member of this project conversation');
    }

    if (
      mode === 'send' &&
      (member.role === Role.VIEWER || project.workspace.organization.archive)
    ) {
      throw new ForbiddenException('This project conversation is read-only');
    }

    return project;
  }

  private async assertOrganizationMember(organizationId: string, userId: string) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      select: { userId: true },
    });

    if (!membership) {
      throw new ForbiddenException('Users must share the organization');
    }

    return membership;
  }
}
