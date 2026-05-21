import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SetupAdminDto } from '../dto/setup-admin.dto';
import { Prisma, Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { JwtPayload } from '../strategies/jwt.strategy';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_STATUS_TRANSITIONS,
  DEFAULT_TASK_STATUSES,
  DEFAULT_WORKFLOW,
} from '../../../constants/defaultWorkflow';

@Injectable()
export class SetupService {
  private readonly logger = new Logger(SetupService.name);
  private static setupInProgress = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async isSetupRequired(): Promise<boolean> {
    const userCount = await this.prisma.user.count();
    return userCount === 0;
  }

  async setupSuperAdmin(setupAdminDto: SetupAdminDto): Promise<AuthResponseDto> {
    if (SetupService.setupInProgress) {
      throw new ConflictException('Setup is already in progress');
    }

    SetupService.setupInProgress = true;

    try {
      return await this.prisma.$transaction(async (prismaTransaction): Promise<AuthResponseDto> => {
        // Double-check no users exist
        const userCount = await prismaTransaction.user.count();
        if (userCount > 0) {
          throw new ConflictException('System setup has already been completed');
        }

        this.logger.log('Starting system setup...');

        const existingUser = await prismaTransaction.user.findUnique({
          where: { email: setupAdminDto.email },
        });
        if (existingUser) {
          throw new ConflictException('User with this email already exists');
        }

        // Unique username generation
        const baseUsername = setupAdminDto.email.split('@')[0].toLowerCase();
        let finalUsername = baseUsername;
        let counter = 1;
        while (
          await prismaTransaction.user.findUnique({
            where: { username: finalUsername },
          })
        ) {
          finalUsername = `${baseUsername}${counter}`;
          counter++;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(setupAdminDto.password, 12);

        // Create super admin user
        const user = await prismaTransaction.user.create({
          data: {
            email: setupAdminDto.email,
            username: finalUsername,
            firstName: setupAdminDto.firstName,
            lastName: setupAdminDto.lastName,
            password: hashedPassword,
            role: Role.SUPER_ADMIN,
            status: UserStatus.ACTIVE,
            emailVerified: true,
            bio: 'System Super Administrator',
            timezone: 'UTC',
            language: 'en',
            preferences: {
              setup_admin: true,
              created_during_setup: true,
              auto_verified: true,
            },
          },
        });

        // Generate JWT tokens
        const payload: JwtPayload = {
          sub: user.id,
          email: user.email,
          role: user.role,
        };

        const accessToken = this.jwtService.sign(payload);
        const refreshToken = this.jwtService.sign(payload, {
          expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d') as any,
        });

        // Save refresh token
        await prismaTransaction.user.update({
          where: { id: user.id },
          data: { refreshToken },
        });

        await this.createSingleCompanyDefaults(prismaTransaction, user.id);

        return {
          access_token: accessToken,
          refresh_token: refreshToken,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            username: user.username || undefined,
            avatar: user.avatar || undefined,
            bio: user.bio || undefined,
            mobileNumber: user.mobileNumber || undefined,
          },
        };
      });
    } catch (error) {
      this.logger.error('Setup failed:', error);
      throw error;
    } finally {
      SetupService.setupInProgress = false;
    }
  }

  async validateSetupState(): Promise<{ canSetup: boolean; message?: string }> {
    if (SetupService.setupInProgress) {
      return {
        canSetup: false,
        message: 'Setup is currently in progress',
      };
    }

    const userCount = await this.prisma.user.count();
    if (userCount > 0) {
      return {
        canSetup: false,
        message: 'System setup has already been completed',
      };
    }

    return { canSetup: true };
  }

  private async createSingleCompanyDefaults(
    prismaTransaction: Prisma.TransactionClient,
    userId: string,
  ): Promise<void> {
    const organization = await prismaTransaction.organization.upsert({
      where: { slug: 'mekong' },
      update: {
        name: 'mekong',
        description: 'Default organization for Mekong projects',
        ownerId: userId,
        updatedBy: userId,
        archive: false,
      },
      create: {
        name: 'mekong',
        slug: 'mekong',
        description: 'Default organization for Mekong projects',
        ownerId: userId,
        createdBy: userId,
        updatedBy: userId,
        settings: {
          allowPublicSignup: false,
          defaultUserRole: Role.MEMBER,
          singleCompanyMode: true,
        },
      },
      select: { id: true },
    });

    await prismaTransaction.organizationMember.upsert({
      where: {
        userId_organizationId: {
          userId,
          organizationId: organization.id,
        },
      },
      update: {
        role: Role.SUPER_ADMIN,
        isDefault: true,
      },
      create: {
        userId,
        organizationId: organization.id,
        role: Role.SUPER_ADMIN,
        isDefault: true,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    const workspace = await prismaTransaction.workspace.upsert({
      where: {
        organizationId_slug: {
          organizationId: organization.id,
          slug: 'projects',
        },
      },
      update: {
        updatedBy: userId,
      },
      create: {
        name: 'Projects',
        slug: 'projects',
        description: 'Default internal project area',
        organizationId: organization.id,
        createdBy: userId,
        updatedBy: userId,
        settings: {
          hiddenInSingleCompanyMode: true,
        },
      },
      select: { id: true },
    });

    await prismaTransaction.workspaceMember.upsert({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId: workspace.id,
        },
      },
      update: {
        role: Role.SUPER_ADMIN,
      },
      create: {
        userId,
        workspaceId: workspace.id,
        role: Role.SUPER_ADMIN,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    const workflow = await prismaTransaction.workflow.findFirst({
      where: { organizationId: organization.id, isDefault: true },
      include: { statuses: true },
    });

    if (!workflow) {
      const createdWorkflow = await prismaTransaction.workflow.create({
        data: {
          name: DEFAULT_WORKFLOW.name,
          description: DEFAULT_WORKFLOW.description,
          isDefault: true,
          organizationId: organization.id,
          createdBy: userId,
          updatedBy: userId,
          statuses: {
            create: DEFAULT_TASK_STATUSES.map((status) => ({
              name: status.name,
              color: status.color,
              category: status.category,
              position: status.position,
              isDefault: status.isDefault,
              createdBy: userId,
              updatedBy: userId,
            })),
          },
        },
        include: { statuses: true },
      });
      await this.createDefaultStatusTransitions(
        prismaTransaction,
        createdWorkflow.id,
        createdWorkflow.statuses,
        userId,
      );
    }

    await Promise.all([
      this.upsertGlobalSetting(
        prismaTransaction,
        'default_organization_id',
        organization.id,
        'Single company organization used for all registered users',
        'registration',
      ),
      this.upsertGlobalSetting(
        prismaTransaction,
        'allow_org_creation',
        'false',
        'Single company mode disables organization creation',
        'registration',
      ),
    ]);
  }

  private async createDefaultStatusTransitions(
    prismaTransaction: Prisma.TransactionClient,
    workflowId: string,
    statuses: Array<{ id: string; name: string }>,
    userId: string,
  ): Promise<void> {
    const statusMap = new Map(statuses.map((status) => [status.name, status.id]));
    const transitions = DEFAULT_STATUS_TRANSITIONS.flatMap((transition) => {
      const fromStatusId = statusMap.get(transition.from);
      const toStatusId = statusMap.get(transition.to);
      if (!fromStatusId || !toStatusId) return [];

      return [
        {
          name: `${transition.from} -> ${transition.to}`,
          workflowId,
          fromStatusId,
          toStatusId,
          createdBy: userId,
          updatedBy: userId,
        },
      ];
    });

    if (transitions.length > 0) {
      await prismaTransaction.statusTransition.createMany({
        data: transitions,
        skipDuplicates: true,
      });
    }
  }

  private async upsertGlobalSetting(
    prismaTransaction: Prisma.TransactionClient,
    key: string,
    value: string,
    description: string,
    category: string,
  ): Promise<void> {
    const existing = await prismaTransaction.settings.findFirst({
      where: { key, userId: null },
    });

    if (existing) {
      await prismaTransaction.settings.update({
        where: { id: existing.id },
        data: { value, description, category, isEncrypted: false },
      });
      return;
    }

    await prismaTransaction.settings.create({
      data: { key, value, userId: null, description, category, isEncrypted: false },
    });
  }
}
