import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AdminService } from './admin.service';

describe('AdminService role management', () => {
  const createService = (prismaOverrides: Partial<any> = {}) => {
    const prisma = {
      user: {
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      organizationMember: {
        updateMany: jest.fn(),
      },
      workspaceMember: {
        updateMany: jest.fn(),
      },
      ...prismaOverrides,
    };

    const service = new AdminService(prisma as any, {} as any, {} as any);
    return { service, prisma };
  };

  it('allows a super admin to promote a member to manager', async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: Role.MEMBER });
    prisma.user.update.mockResolvedValue({ id: 'user-1', role: Role.MANAGER });

    await expect(service.updateUserRole('user-1', Role.MANAGER, 'admin-1')).resolves.toEqual({
      id: 'user-1',
      role: Role.MANAGER,
    });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: { role: Role.MANAGER },
      }),
    );
  });

  it('rejects workspace-only roles at the system role endpoint', async () => {
    const { service } = createService();

    await expect(service.updateUserRole('user-1', Role.OWNER, 'admin-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.updateUserRole('user-1', Role.VIEWER, 'admin-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('does not allow changing your own role', async () => {
    const { service } = createService();

    await expect(service.updateUserRole('admin-1', Role.MEMBER, 'admin-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
