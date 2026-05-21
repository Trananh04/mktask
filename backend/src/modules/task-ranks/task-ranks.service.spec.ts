import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/prisma/prisma.service';
import { TaskRanksService } from './task-ranks.service';

describe('TaskRanksService', () => {
  let service: TaskRanksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskRanksService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<TaskRanksService>(TaskRanksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
