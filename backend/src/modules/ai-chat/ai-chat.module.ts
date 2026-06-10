import { Module } from '@nestjs/common';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';
import { SettingsModule } from '../settings/settings.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { AiDataToolsService } from './ai-data-tools.service';
import { QueryPlannerService } from './query-planner.service';

@Module({
  imports: [SettingsModule, PrismaModule],
  controllers: [AiChatController],
  providers: [AiChatService, AiDataToolsService, QueryPlannerService],
  exports: [AiChatService],
})
export class AiChatModule {}
