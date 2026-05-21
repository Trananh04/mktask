import { IsArray, IsOptional, IsString } from 'class-validator';

export class AnalyzeWorkloadDto {
  @IsArray()
  members: Array<Record<string, unknown>>;

  @IsArray()
  tasks: Array<Record<string, unknown>>;

  @IsOptional()
  @IsString()
  query?: string;
}

export class AnalyzeWorkloadResponseDto {
  analysis: string;
  assignments: Array<Record<string, unknown>>;
  warnings: string[];
}
