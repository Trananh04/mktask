import { SetMetadata } from '@nestjs/common';
import { UserScope } from './ai-data-tools.service';

export const AI_TOOL_METADATA_KEY = 'AI_TOOL_METADATA_KEY';

export interface AiToolOptions {
  name: string;
  description: string;
  params: Record<string, string>;
  allowedRoles: Array<UserScope['role']>;
}

export const AiTool = (options: AiToolOptions) => SetMetadata(AI_TOOL_METADATA_KEY, options);
