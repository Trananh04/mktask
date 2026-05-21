import { ApiProperty } from '@nestjs/swagger';
import { TaskDailyReportType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class RequestTaskStatusChangeDto {
  @ApiProperty({ description: 'Target task status id' })
  @IsUUID()
  statusId: string;

  @ApiProperty({ required: false, description: 'Optional note for the manager' })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  note?: string;
}

export class ReviewTaskStatusChangeDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  @IsIn(['APPROVED', 'REJECTED'])
  decision: 'APPROVED' | 'REJECTED';

  @ApiProperty({ required: false, description: 'Manager review note' })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  note?: string;
}

export class CreateTaskDailyReportDto {
  @ApiProperty({ enum: TaskDailyReportType })
  @IsEnum(TaskDailyReportType)
  type: TaskDailyReportType;

  @ApiProperty({ required: false, description: 'Report date. Defaults to today.' })
  @IsDateString()
  @IsOptional()
  reportDate?: string;

  @ApiProperty({ description: 'Report content' })
  @IsString()
  @MaxLength(4000)
  content: string;

  @ApiProperty({ required: false, description: 'Blockers or risks' })
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  blockers?: string;

  @ApiProperty({ required: false, minimum: 0, maximum: 100 })
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  progressPercent?: number;
}

export class ReviewTaskDailyReportDto {
  @ApiProperty({ required: false, description: 'Manager review note' })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  note?: string;
}
