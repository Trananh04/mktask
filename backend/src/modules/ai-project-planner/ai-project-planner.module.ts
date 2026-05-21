import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { ProjectsModule } from '../projects/projects.module';
import { TasksModule } from '../tasks/tasks.module';
import { AiProjectPlannerController } from './ai-project-planner.controller';
import { AiProjectPlannerService } from './ai-project-planner.service';

@Module({
  imports: [PrismaModule, SettingsModule, ProjectsModule, TasksModule],
  controllers: [AiProjectPlannerController],
  providers: [AiProjectPlannerService],
})
export class AiProjectPlannerModule {}
