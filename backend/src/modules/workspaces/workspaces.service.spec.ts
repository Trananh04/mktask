import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { WorkspacesService } from './workspaces.service';

describe('WorkspacesService permissions', () => {
  const organizationId = '11111111-1111-4111-8111-111111111111';
  const memberId = '22222222-2222-4222-8222-222222222222';
  const ownerId = '33333333-3333-4333-8333-333333333333';

  const createService = () => {
    const prisma: any = {
      organization: {
        findUnique: jest.fn().mockResolvedValue({
          id: organizationId,
          ownerId,
          archive: false,
          members: [{ userId: memberId, role: Role.MEMBER }],
        }),
      },
      workspace: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn().mockResolvedValue({
        id: 'workspace-id',
        name: 'Member Workspace',
        slug: 'member-workspace',
      }),
    };
    const accessControl: any = {
      getOrgAccess: jest.fn().mockResolvedValue({
        isElevated: false,
        isSuperAdmin: false,
      }),
    };
    const settingsService: any = {
      get: jest.fn().mockResolvedValue('true'),
    };
    const activityLog: any = {
      log: jest.fn(),
    };

    return {
      service: new WorkspacesService(prisma, accessControl, settingsService, activityLog),
      prisma,
    };
  };

  it('rejects workspace creation from organization members', async () => {
    const { service, prisma } = createService();

    await expect(
      service.create(
        {
          name: 'Member Workspace',
          slug: 'member-workspace',
          organizationId,
        },
        memberId,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
