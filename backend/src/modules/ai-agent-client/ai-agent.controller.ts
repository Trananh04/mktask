import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AiAgentService } from './ai-agent.service';
import { AnalyzeWorkloadDto, AnalyzeWorkloadResponseDto } from './dto/analyze-workload.dto';

@ApiTags('AI Agent')
@ApiBearerAuth('JWT-auth')
@Controller('ai-agent')
export class AiAgentController {
  constructor(private readonly aiAgentService: AiAgentService) {}

  @Post('analyze')
  @ApiOperation({ summary: 'Analyze team workload and recommend task assignments' })
  @ApiResponse({ status: 200, type: AnalyzeWorkloadResponseDto })
  analyzeWorkload(@Body() dto: AnalyzeWorkloadDto): AnalyzeWorkloadResponseDto {
    return this.aiAgentService.analyzeWorkload(dto);
  }
}
