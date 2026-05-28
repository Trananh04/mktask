import { Role } from '@prisma/client';
import { InvitationsService } from './invitations.service';

describe('InvitationsService project invitations', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const inviterId = '22222222-2222-4222-8222-222222222222';
  const organizationId = '33333333-3333-4333-8333-333333333333';
  const workspaceId = '44444444-4444-4444-8444-444444444444';
  const projectId = '55555555-5555-4555-8555-555555555555';
  const invitationId = '66666666-6666-4666-8666-666666666666';

  const createService = () => {
    const invitation = {
      id: invitationId,
      token: 'project-token',
      inviteeEmail: 'member@example.com',
      inviterId,
      projectId,
      workspaceId: null,
      organizationId: null,
      role: Role.MEMBER,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 60_000),
      organization: null,
      workspace: null,
      project: {
        id: projectId,
        name: 'Invited Project',
        workspace: {
          id: workspaceId,
          organizationId,
        },
      },
    };
    const prisma: any = {
      invitation: {
        findUnique: jest.fn().mockResolvedValue(invitation),
        update: jest.fn().mockResolvedValue({ ...invitation, status: 'ACCEPTED' }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: userId,
          email: invitation.inviteeEmail,
        }),
      },
      organizationMember: {
        findFirst: jest.fn().mockResolvedValue({ id: 'org-member-id', userId, organizationId }),
        create: jest.fn(),
      },
      workspaceMember: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      projectMember: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'project-member-id', userId, projectId }),
      },
    };
    const workspaceMemberService = {
      create: jest.fn(),
    };
    const service = new InvitationsService(
      prisma,
      {} as any,
      workspaceMemberService as any,
      {} as any,
      {} as any,
      {} as any,
    );

    return { service, prisma, workspaceMemberService };
  };

  it('accepts a project invitation without granting workspace membership', async () => {
    const { service, prisma, workspaceMemberService } = createService();

    await service.acceptInvitation('project-token', userId);

    expect(workspaceMemberService.create).not.toHaveBeenCalled();
    expect(prisma.projectMember.create).toHaveBeenCalledWith({
      data: {
        userId,
        projectId,
        role: Role.MEMBER,
        createdBy: inviterId,
      },
    });
    expect(prisma.invitation.update).toHaveBeenCalledWith({
      where: { id: invitationId },
      data: { status: 'ACCEPTED' },
    });
  });
});
