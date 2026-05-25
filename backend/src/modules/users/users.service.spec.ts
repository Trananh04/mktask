import { Role } from '@prisma/client';

jest.mock('../storage/storage.service', () => ({
  StorageService: class StorageService {},
}));

import { UsersService } from './users.service';

describe('UsersService', () => {
  const user = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'anh@example.com',
    username: 'anh',
    firstName: 'Anh',
    lastName: 'Tran',
    avatar: 'avatar/profile.png',
    bio: null,
    mobileNumber: null,
    timezone: 'Asia/Saigon',
    language: 'vi',
    role: Role.MEMBER,
    status: 'ACTIVE',
    lastLoginAt: null,
    emailVerified: true,
    refreshToken: null,
    preferences: null,
    onboardInfo: null,
    resetToken: null,
    resetTokenExpiry: null,
    defaultOrganizationId: null,
    source: null,
    externalId: null,
    externalProvider: null,
    createdAt: new Date('2026-05-22T00:00:00.000Z'),
    updatedAt: new Date('2026-05-22T00:00:00.000Z'),
    deletedAt: null,
    deletedBy: null,
  };

  const createService = () => {
    const prisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
      },
    };
    const storageService: any = {
      isUsingS3: jest.fn().mockReturnValue(true),
      getFileUrl: jest.fn().mockResolvedValue('https://storage.example.com/avatar/profile.png'),
    };

    return {
      prisma,
      storageService,
      service: new UsersService(prisma, storageService),
    };
  };

  it('returns a usable S3 avatar URL when reloading a user profile', async () => {
    const { service, storageService } = createService();

    await expect(service.findOne(user.id)).resolves.toEqual(
      expect.objectContaining({
        id: user.id,
        avatar: 'https://storage.example.com/avatar/profile.png',
      }),
    );
    expect(storageService.getFileUrl).toHaveBeenCalledWith(user.avatar);
  });
});
