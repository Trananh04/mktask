import { ProjectVisibility, Role } from '@prisma/client';
import { ProjectMembersService } from './project-members.service';

describe('ProjectMembersService create', () => {
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const userId = '22222222-2222-4222-8222-222222222222';
  const projectId = '33333333-3333-4333-8333-333333333333';
  const workspaceId = '44444444-4444-4444-8444-444444444444';
  const organizationId = '55555555-5555-4555-8555-555555555555';

  const project = {
    id: projectId,
    name: 'Launch Plan',
    slug: 'launch-plan',
    visibility: ProjectVisibility.PRIVATE,
    workspaceId,
    workspace: {
      id: workspaceId,
      name: 'Product',
      slug: 'product',
      organizationId,
      organization: {
        id: organizationId,
        name: 'Acme',
        ownerId,
      },
    },
  };

  const createService = () => {
    const createdMember = {
      id: '66666666-6666-4666-8666-666666666666',
      userId,
      projectId,
      role: Role.MEMBER,
    };
    const prisma: any = {
      project: {
        findUnique: jest.fn().mockResolvedValue(project),
      },
      user: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({ role: Role.MEMBER })
          .mockResolvedValueOnce({
            id: userId,
            email: 'member@example.com',
            firstName: 'Member',
            lastName: 'Only',
            workspaceMembers: [],
            organizationMembers: [{ id: 'org-member-id', role: Role.MEMBER }],
          }),
        findUnique: jest.fn().mockResolvedValue({ role: Role.MEMBER }),
      },
      projectMember: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(createdMember),
      },
      workspaceMember: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({
          id: 'workspace-member-id',
          userId,
          workspaceId,
          role: Role.MEMBER,
        }),
      },
      organizationMember: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };
    const notificationsService: any = {
      createNotification: jest.fn().mockResolvedValue({}),
    };
    const invitationsService: any = {};

    return {
      service: new ProjectMembersService(prisma, notificationsService, invitationsService),
      prisma,
      notificationsService,
      createdMember,
    };
  };

  it('adds organization-only users only to the requested project', async () => {
    const { service, prisma, notificationsService, createdMember } = createService();

    await expect(
      service.create({ userId, projectId, role: Role.MEMBER }, ownerId),
    ).resolves.toEqual(createdMember);

    expect(prisma.workspaceMember.upsert).not.toHaveBeenCalled();
    expect(prisma.projectMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          userId,
          projectId,
          role: Role.MEMBER,
          createdBy: ownerId,
        },
      }),
    );
    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        organizationId,
        actionUrl: '/product/launch-plan',
      }),
    );
  });
});
