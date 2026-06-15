import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { QueryPlannerService } from './modules/ai-chat/query-planner.service';
import { AiDataToolsService } from './modules/ai-chat/ai-data-tools.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const queryPlanner = app.get(QueryPlannerService);
  const aiDataTools = app.get(AiDataToolsService);

  // We assume user id is the first user in db or we just mock a scope
  const userId = '11111111-1111-1111-1111-111111111111'; // Dummy

  const userScope = {
    role: 'SUPER_ADMIN',
    accessibleProjectIds: [],
    managedProjectIds: [],
    memberProjectIds: [],
    currentUserId: userId,
  } as any;

  const history = [
    { role: 'user', content: 'ngày hôm nay có những ai báo cáo' },
    {
      role: 'assistant',
      content: 'Hôm nay có 2 người đã báo cáo: 1. Phuong Do Trieu Duc 2. Admin User',
    },
  ];

  const plan = await queryPlanner.planQuery(
    'nội dung báo cáo của 2 người đó là gì',
    userScope,
    userId,
    undefined,
    history,
  );

  console.log('FINAL PLAN:', plan);
  await app.close();
}
bootstrap();
