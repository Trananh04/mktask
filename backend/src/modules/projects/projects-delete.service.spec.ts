import { Role } from '@prisma/client';
import { ProjectsService } from './projects.service';

describe('ProjectsService delete project', () => {
  const projectId = '11111111-1111-4111-8111-111111111111';
  const ownerId = '22222222-2222-4222-8222-222222222222';

  const createService = () => {
    const tx: any = {
      task: {
        deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
      project: {
        delete: jest.fn().mockResolvedValue({ id: projectId }),
      },
    };
    const prisma: any = {
      $transaction: jest.fn(async (callback: (tx: any) => Promise<void>) => callback(tx)),
    };
    const accessControl: any = {
      getProjectAccess: jest.fn().mockResolvedValue({ role: Role.OWNER }),
    };

    return {
      service: new ProjectsService(prisma, accessControl, {} as any, {} as any),
      prisma,
      tx,
    };
  };

  it('deletes project tasks in the same transaction before deleting the project', async () => {
    const { service, prisma, tx } = createService();

    await service.remove(projectId, ownerId);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.task.deleteMany).toHaveBeenCalledWith({ where: { projectId } });
    expect(tx.project.delete).toHaveBeenCalledWith({ where: { id: projectId } });
  });
});
