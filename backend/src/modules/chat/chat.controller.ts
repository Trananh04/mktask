import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateDirectConversationDto } from './dto/create-direct-conversation.dto';
import { SendChatMessageDto } from './dto/send-chat-message.dto';
import { ChatService } from './chat.service';
import { ToggleChatReactionDto } from './dto/toggle-chat-reaction.dto';
import { CreateTaskFromChatMessageDto } from './dto/create-task-from-chat-message.dto';

interface AuthenticatedUser {
  id: string;
}

@ApiTags('Chat')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'List conversations visible to the current user' })
  @ApiQuery({ name: 'organizationId', required: false })
  listConversations(
    @CurrentUser() user: AuthenticatedUser,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.chatService.listConversations(user.id, organizationId);
  }

  @Get('contacts')
  @ApiOperation({ summary: 'List organization contacts available for direct messages' })
  listContacts(
    @CurrentUser() user: AuthenticatedUser,
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
  ) {
    return this.chatService.listContacts(organizationId, user.id);
  }

  @Get('unread-summary')
  @ApiOperation({ summary: 'Get unread chat message counts for the current user' })
  @ApiQuery({ name: 'organizationId', required: false })
  getUnreadSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.chatService.getUnreadSummary(user.id, organizationId);
  }

  @Post('direct-conversations')
  @ApiOperation({ summary: 'Create or reuse a direct conversation' })
  createDirectConversation(
    @Body() dto: CreateDirectConversationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.chatService.createDirectConversation(dto, user.id);
  }

  @Post('projects/:projectId/conversation')
  @ApiOperation({ summary: 'Create or reuse the current project conversation' })
  openProjectConversation(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.chatService.getOrCreateProjectConversation(projectId, user.id);
  }

  @Post('workspaces/:workspaceId/conversation')
  @ApiOperation({ summary: 'Create or reuse the current workspace conversation' })
  openWorkspaceConversation(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.chatService.getOrCreateWorkspaceConversation(workspaceId, user.id);
  }

  @Get('conversations/:conversationId/messages')
  @ApiOperation({ summary: 'List conversation messages' })
  listMessages(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.chatService.listMessages(
      conversationId,
      user.id,
      Number(limit) || undefined,
      cursor,
    );
  }

  @Get('conversations/:conversationId/messages/search')
  @ApiOperation({ summary: 'Search conversation messages' })
  searchMessages(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('q') query?: string,
    @Query('senderId') senderId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatService.searchMessages(conversationId, user.id, {
      query,
      senderId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: Number(limit) || undefined,
    });
  }

  @Post('conversations/:conversationId/messages')
  @ApiOperation({ summary: 'Send a chat message' })
  sendMessage(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() dto: SendChatMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.chatService.sendMessage(conversationId, user.id, dto.content, {
      parentMessageId: dto.parentMessageId,
      mentionedUserIds: dto.mentionedUserIds,
      attachments: dto.attachments,
    });
  }

  @Post('conversations/:conversationId/read')
  @ApiOperation({ summary: 'Mark a chat conversation as read' })
  markConversationRead(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.chatService.markConversationRead(conversationId, user.id);
  }

  @Get('conversations/:conversationId/read-receipts')
  @ApiOperation({ summary: 'List conversation read receipts' })
  getReadReceipts(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.chatService.getReadReceipts(conversationId, user.id);
  }

  @Post('messages/:messageId/reactions')
  @ApiOperation({ summary: 'Toggle a reaction for a chat message' })
  toggleReaction(
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() dto: ToggleChatReactionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.chatService.toggleReaction(messageId, user.id, dto.type);
  }

  @Post('messages/:messageId/pin')
  @ApiOperation({ summary: 'Pin or unpin a chat message' })
  togglePin(
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.chatService.togglePin(messageId, user.id);
  }

  @Post('messages/:messageId/create-task')
  @ApiOperation({ summary: 'Create a project task from a chat message' })
  createTaskFromMessage(
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() dto: CreateTaskFromChatMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.chatService.createTaskFromMessage(messageId, user.id, dto);
  }
}
