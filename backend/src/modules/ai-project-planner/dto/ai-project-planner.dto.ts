import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class PlanProjectRequestDto {
  @ApiProperty({
    description: 'Workspace ID where the generated projects will be created',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  workspaceId?: string;

  @ApiProperty({ description: 'Free-form project description from the user' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  description: string;
}

export class PlannedTaskDto {
  @IsString()
  id: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  requiredSkills: string[];

  @IsOptional()
  estimateHours?: number;

  @IsOptional()
  storyPoints?: number;

  @IsString()
  @IsOptional()
  priority?: string;

  @IsString()
  @IsOptional()
  assigneeId?: string;

  @IsString()
  @IsOptional()
  assigneeName?: string;
}

export class PlannedProjectDto {
  @IsString()
  id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlannedTaskDto)
  @ArrayMaxSize(80)
  tasks: PlannedTaskDto[];
}

export class ProjectPlanDto {
  @IsString()
  summary: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlannedProjectDto)
  @ArrayMaxSize(12)
  projects: PlannedProjectDto[];

  @IsArray()
  @IsString({ each: true })
  warnings: string[];
}

export class ApplyProjectPlanRequestDto {
  @IsUUID()
  @IsOptional()
  workspaceId?: string;

  @ValidateNested()
  @Type(() => ProjectPlanDto)
  plan: ProjectPlanDto;

  @IsBoolean()
  @IsOptional()
  createAssignments?: boolean;
}

export class ApplyProjectPlanResponseDto {
  createdProjects: Array<{ id: string; name: string; slug: string }>;
  createdTasks: Array<{ id: string; title: string; projectId: string; assigneeId?: string }>;
  warnings: string[];
}
