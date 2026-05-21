import { Injectable } from '@nestjs/common';
import { AnalyzeWorkloadDto, AnalyzeWorkloadResponseDto } from './dto/analyze-workload.dto';
import { analyzeWorkload } from './workload-analyzer';

@Injectable()
export class AiAgentService {
  analyzeWorkload(input: AnalyzeWorkloadDto): AnalyzeWorkloadResponseDto {
    const result = analyzeWorkload(input);
    return {
      analysis: result.analysis,
      assignments: result.assignments.map((assignment) => ({ ...assignment })),
      warnings: result.warnings,
    };
  }
}
