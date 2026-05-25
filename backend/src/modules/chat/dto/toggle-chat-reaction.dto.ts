import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export const CHAT_REACTION_TYPES = ['HEART', 'LIKE', 'HAHA', 'CHECK'] as const;
export type ChatReactionType = (typeof CHAT_REACTION_TYPES)[number];

export class ToggleChatReactionDto {
  @ApiProperty({ enum: CHAT_REACTION_TYPES, example: 'HEART' })
  @IsIn(CHAT_REACTION_TYPES)
  type: ChatReactionType;
}
