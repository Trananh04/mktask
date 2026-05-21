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
});
