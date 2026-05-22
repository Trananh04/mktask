import { Role } from '@prisma/client';
import { ProjectsService } from './projects.service';

describe('ProjectsService project listing', () => {
  const organizationId = '11111111-1111-4111-8111-111111111111';
  const managerId = '22222222-2222-4222-8222-222222222222';
  const workspaceId = '33333333-3333-4333-8333-333333333333';

  const createService = () => {
    const prisma: any = {
      organization: {
        findUnique: jest.fn().mockResolvedValue({ id: organizationId }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ role: Role.MEMBER }),
      },
      project: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const accessControl: any = {};

    return {
      service: new ProjectsService(prisma, accessControl, {} as any, {} as any),
      prisma,
    };
  };

  it('limits organization managers to projects where they are project members', async () => {
    const { service, prisma } = createService();

    await service.findByOrganizationId({ organizationId }, managerId);

    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          members: { some: { userId: managerId } },
        }),
      }),
    );
  });

  it('keeps organization members limited to projects where they are project members', async () => {
    const { service, prisma } = createService();

    await service.findByOrganizationId({ organizationId }, managerId);

    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          members: { some: { userId: managerId } },
        }),
      }),
    );
  });

  it('limits workspace managers to projects where they are project members', async () => {
    const { service, prisma } = createService();

    await service.findAll(workspaceId, managerId);

    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          members: { some: { userId: managerId } },
        }),
      }),
    );
  });
});
