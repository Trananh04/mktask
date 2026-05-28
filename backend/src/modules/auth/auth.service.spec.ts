import { Role } from '@prisma/client';
jest.mock('../users/users.service', () => ({
  UsersService: class UsersService {},
}));

import { AuthService } from './auth.service';
import * as bcrypt from 'bcrypt';

describe('AuthService internal registration model', () => {
  const createService = (overrides: Partial<any> = {}) => {
    const usersService = {
      findByEmail: jest.fn(),
      findByUsername: jest.fn(),
      create: jest.fn(),
      updateRefreshToken: jest.fn(),
      ...overrides.usersService,
    };
    const prisma = {
      user: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      organization: { findUnique: jest.fn() },
      organizationMember: { findUnique: jest.fn(), create: jest.fn() },
      workspace: { findFirst: jest.fn(), create: jest.fn() },
      workspaceMember: { upsert: jest.fn() },
      ...overrides.prisma,
    };
    const jwtService = {
      sign: jest.fn().mockReturnValue('signed-token'),
    };
    const configService = {
      get: jest.fn((_key: string, fallback?: string) => fallback),
    };
    const settingsService = {
      get: jest.fn().mockResolvedValue(null),
      ...overrides.settingsService,
    };
    const service = new AuthService(
      prisma as any,
      usersService as any,
      jwtService as any,
      configService as any,
      {} as any,
      settingsService as any,
    );
    return { service, prisma, usersService };
  };

  it('keeps the first normal login at MEMBER instead of auto-promoting to super admin', async () => {
    const password = 'secret';
    const hashedPassword = await bcrypt.hash(password, 4);
    const { service, prisma, usersService } = createService();
    usersService.findByEmail.mockResolvedValue({
      id: 'first-user',
      email: 'member@example.com',
      password: hashedPassword,
      status: 'ACTIVE',
      role: Role.MEMBER,
      firstName: 'First',
      lastName: 'User',
    });

    const result = await service.login({ email: 'member@example.com', password });

    expect(result.user.role).toBe(Role.MEMBER);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('does not make newly registered users workspace members of the default organization', async () => {
    const organizationId = '11111111-1111-4111-8111-111111111111';
    const user = {
      id: 'new-user',
      email: 'new@example.com',
      role: Role.MEMBER,
      firstName: 'New',
      lastName: 'User',
    };
    const { service, prisma, usersService } = createService({
      settingsService: {
        get: jest.fn(async (key: string) =>
          key === 'default_organization_id' ? organizationId : null,
        ),
      },
    });
    usersService.findByEmail.mockResolvedValue(null);
    usersService.findByUsername.mockResolvedValue(null);
    usersService.create.mockResolvedValue(user);
    prisma.organization.findUnique.mockResolvedValue({ id: organizationId });
    prisma.organizationMember.findUnique.mockResolvedValue(null);
    prisma.workspace.findFirst.mockResolvedValue({ id: 'workspace-id' });

    await service.register({
      email: user.email,
      password: 'StrongPassword123!',
      firstName: user.firstName,
      lastName: user.lastName,
    });

    expect(prisma.organizationMember.create).toHaveBeenCalledWith({
      data: {
        userId: user.id,
        organizationId,
        role: Role.MEMBER,
      },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { defaultOrganizationId: organizationId },
    });
    expect(prisma.workspace.findFirst).not.toHaveBeenCalled();
    expect(prisma.workspace.create).not.toHaveBeenCalled();
    expect(prisma.workspaceMember.upsert).not.toHaveBeenCalled();
  });
});
