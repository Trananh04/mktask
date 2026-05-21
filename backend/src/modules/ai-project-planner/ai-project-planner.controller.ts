import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role, User } from '@prisma/client';
import { Roles } from '../../common/decorator/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  ApplyProjectPlanRequestDto,
  ApplyProjectPlanResponseDto,
  PlanProjectRequestDto,
  ProjectPlanDto,
} from './dto/ai-project-planner.dto';
import { AiProjectPlannerService } from './ai-project-planner.service';

@ApiTags('AI Project Planner')
@Controller('ai-project-planner')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.MANAGER, Role.OWNER)
export class AiProjectPlannerController {
  constructor(private readonly plannerService: AiProjectPlannerService) {}

  @Post('plan')
  @ApiOperation({ summary: 'Generate a draft project/task plan from a project description' })
  @ApiResponse({ status: 200, type: ProjectPlanDto })
  plan(@CurrentUser() user: User, @Body() dto: PlanProjectRequestDto): Promise<ProjectPlanDto> {
    return this.plannerService.plan(dto, user.id);
  }

  @Post('apply')
  @ApiOperation({ summary: 'Create projects and tasks from an approved AI project plan' })
  @ApiResponse({ status: 200, type: ApplyProjectPlanResponseDto })
  apply(
    @CurrentUser() user: User,
    @Body() dto: ApplyProjectPlanRequestDto,
  ): Promise<ApplyProjectPlanResponseDto> {
    return this.plannerService.apply(dto, user.id);
  }
}
