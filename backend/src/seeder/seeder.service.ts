import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersSeederService } from './users.seeder.service';
import { OrganizationsSeederService } from './organizations.seeder.service';
import { WorkspacesSeederService } from './workspaces.seeder.service';
import { ProjectsSeederService } from './projects.seeder.service';
import { WorkflowSeederService } from './workflow.seeder';
import { TaskStatusSeederService } from './taskstatus.seeder.service';
import { TasksSeederService } from './tasks.seeder.service';
import { SprintsSeederService } from './sprints.seeder.service';
import { LabelsSeederService } from './labels.seeder.service';
import { TaskCommentsSeederService } from './task-comments.seeder.service';
import { TaskDependenciesSeederService } from './task-dependencies.seeder.service';
import { TaskWatchersSeederService } from './task-watchers.seeder.service';
import { TimeEntriesSeederService } from './time-entries.seeder.service';
import { AdminSeederService } from './admin-seeder.service';
import { InboxRulesSeederService } from './inbox-rules.seeder.service';
import {
  DEFAULT_STATUS_TRANSITIONS,
  DEFAULT_TASK_STATUSES,
  DEFAULT_WORKFLOW,
} from '../constants/defaultWorkflow';

@Injectable()
export class SeederService {
  constructor(
    private prisma: PrismaService,
    private adminSeeder: AdminSeederService,
    private usersSeeder: UsersSeederService,
    private organizationsSeeder: OrganizationsSeederService,
    private workspacesSeeder: WorkspacesSeederService,
    private workflowsSeeder: WorkflowSeederService,
    private projectsSeeder: ProjectsSeederService,
    private taskStatusSeeder: TaskStatusSeederService,
    private tasksSeeder: TasksSeederService,
    private sprintsSeeder: SprintsSeederService,
    private labelsSeeder: LabelsSeederService,
    private taskCommentsSeeder: TaskCommentsSeederService,
    private taskDependenciesSeeder: TaskDependenciesSeederService,
    private taskWatchersSeeder: TaskWatchersSeederService,
    private timeEntriesSeeder: TimeEntriesSeederService,
    private inboxRulesSeeder: InboxRulesSeederService,
  ) {}

  async seedCoreModules() {
    console.log('🌱 Starting core modules seeding...');

    try {
      // 1. Seed Users (foundation)
      const users = await this.usersSeeder.seed();
      console.log('✅ Users seeded');

      // 2. Seed Organizations (depends on users)
      const organizations = await this.organizationsSeeder.seed(users);
      console.log('✅ Organizations seeded');

      // 3. Seed Workspaces (depends on organizations)
      const workspaces = await this.workspacesSeeder.seed(organizations, users);
      console.log('✅ Workspaces seeded');

      // 4. Seed Projects (depends on workspaces and users)
      const projects = await this.projectsSeeder.seed(workspaces, users);
      console.log('✅ Projects seeded');

      // 5. Seed Inbox Rules (depends on projects with inboxes)
      await this.seedInboxRules();

      // 7. Seed Tasks (depends on projects, users, and task statuses)
      const tasks = await this.tasksSeeder.seed(projects, users);
      console.log('✅ Tasks seeded');

      // 8. Seed Labels (depends on projects and users)
      const labels = await this.labelsSeeder.seed(projects, users);
      console.log('✅ Labels seeded');

      // 9. Seed Task Comments (depends on tasks and users)
      const taskComments = await this.taskCommentsSeeder.seed(tasks, users);
      console.log('✅ Task comments seeded');

      // 10. Seed Task Dependencies (depends on tasks and users)
      const taskDependencies = await this.taskDependenciesSeeder.seed(tasks, users);
      console.log('✅ Task dependencies seeded');

      // 11. Seed Task Watchers (depends on tasks and users)
      const taskWatchers = await this.taskWatchersSeeder.seed(tasks, users);
      console.log('✅ Task watchers seeded');

      // 12. Seed Time Entries (depends on tasks and users)
      const timeEntries = await this.timeEntriesSeeder.seed(tasks, users);
      console.log('✅ Time entries seeded');

      console.log('🎉 Core modules seeding completed successfully!');

      return {
        users,
        organizations,
        workspaces,
        projects,
        tasks,
        // sprints,
        labels,
        taskComments,
        taskDependencies,
        taskWatchers,
        timeEntries,
      };
    } catch (_error) {
      console.error('❌ Error seeding core modules:', _error);
      throw _error;
    }
  }
  async adminSeedModules() {
    console.log('🌱 Starting admin modules seeding...');

    try {
      // 0. Seed Admin User (must be first)
      const adminUser = await this.adminSeeder.seed();
      console.log('✅ Admin user seeded');
      return {
        adminUser,
      };
    } catch (_error) {
      console.error('❌ Error seeding core modules:', _error);
      throw _error;
    }
  }

  async clearDemoUsers() {
    console.log('Clearing demo users...');

    const demoEmails = [
      'john.doe@mktask.app',
      'jane.smith@mktask.app',
      'mike.wilson@mktask.app',
      'sarah.jones@mktask.app',
      'alex.brown@mktask.app',
      'emma.davis@mktask.app',
      'tom.garcia@mktask.app',
      'john.doe@taskosaur.com',
      'jane.smith@taskosaur.com',
      'mike.wilson@taskosaur.com',
      'sarah.jones@taskosaur.com',
      'alex.brown@taskosaur.com',
      'emma.davis@taskosaur.com',
      'tom.garcia@taskosaur.com',
    ];

    const demoUsers = await this.prisma.user.findMany({
      where: { email: { in: demoEmails } },
      select: { id: true, email: true },
    });

    if (demoUsers.length === 0) {
      console.log('No demo users found.');
      return { deletedUsers: 0 };
    }

    const replacementUser = await this.prisma.user.findFirst({
      where: {
        email: { notIn: demoEmails },
        OR: [
          { role: 'SUPER_ADMIN' },
          { email: { in: ['admin@mktask.app', 'admin@taskosaur.com'] } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true },
    });

    if (!replacementUser) {
      throw new Error('Cannot clear demo users because no non-demo admin user exists.');
    }

    const demoUserIds = demoUsers.map((user) => user.id);
    const whereDemoUser = { in: demoUserIds };
    const reassign = replacementUser.id;

    await this.prisma.$transaction(async (tx) => {
      await tx.organization.updateMany({
        where: { ownerId: whereDemoUser },
        data: { ownerId: reassign },
      });
      await tx.organization.updateMany({
        where: { createdBy: whereDemoUser },
        data: { createdBy: reassign },
      });
      await tx.organization.updateMany({
        where: { updatedBy: whereDemoUser },
        data: { updatedBy: reassign },
      });

      await tx.workspace.updateMany({
        where: { createdBy: whereDemoUser },
        data: { createdBy: reassign },
      });
      await tx.workspace.updateMany({
        where: { updatedBy: whereDemoUser },
        data: { updatedBy: reassign },
      });
      await tx.project.updateMany({
        where: { createdBy: whereDemoUser },
        data: { createdBy: reassign },
      });
      await tx.project.updateMany({
        where: { updatedBy: whereDemoUser },
        data: { updatedBy: reassign },
      });
      await tx.workflow.updateMany({
        where: { createdBy: whereDemoUser },
        data: { createdBy: reassign },
      });
      await tx.workflow.updateMany({
        where: { updatedBy: whereDemoUser },
        data: { updatedBy: reassign },
      });
      await tx.taskStatus.updateMany({
        where: { createdBy: whereDemoUser },
        data: { createdBy: reassign },
      });
      await tx.taskStatus.updateMany({
        where: { updatedBy: whereDemoUser },
        data: { updatedBy: reassign },
      });
      await tx.taskStatus.updateMany({
        where: { deletedBy: whereDemoUser },
        data: { deletedBy: reassign },
      });
      await tx.statusTransition.updateMany({
        where: { createdBy: whereDemoUser },
        data: { createdBy: reassign },
      });
      await tx.statusTransition.updateMany({
        where: { updatedBy: whereDemoUser },
        data: { updatedBy: reassign },
      });
      await tx.sprint.updateMany({
        where: { createdBy: whereDemoUser },
        data: { createdBy: reassign },
      });
      await tx.sprint.updateMany({
        where: { updatedBy: whereDemoUser },
        data: { updatedBy: reassign },
      });
      await tx.label.updateMany({
        where: { createdBy: whereDemoUser },
        data: { createdBy: reassign },
      });
      await tx.label.updateMany({
        where: { updatedBy: whereDemoUser },
        data: { updatedBy: reassign },
      });
      await tx.taskLabel.updateMany({
        where: { createdBy: whereDemoUser },
        data: { createdBy: reassign },
      });
      await tx.taskLabel.updateMany({
        where: { updatedBy: whereDemoUser },
        data: { updatedBy: reassign },
      });
      await tx.task.updateMany({
        where: { createdBy: whereDemoUser },
        data: { createdBy: reassign },
      });
      await tx.task.updateMany({
        where: { updatedBy: whereDemoUser },
        data: { updatedBy: reassign },
      });
      await tx.task.updateMany({
        where: { archivedBy: whereDemoUser },
        data: { archivedBy: reassign },
      });
      await tx.taskDependency.updateMany({
        where: { createdBy: whereDemoUser },
        data: { createdBy: reassign },
      });
      await tx.taskDependency.updateMany({
        where: { updatedBy: whereDemoUser },
        data: { updatedBy: reassign },
      });
      await tx.taskWatcher.updateMany({
        where: { createdBy: whereDemoUser },
        data: { createdBy: reassign },
      });
      await tx.taskWatcher.updateMany({
        where: { updatedBy: whereDemoUser },
        data: { updatedBy: reassign },
      });
      await tx.taskComment.updateMany({
        where: { createdBy: whereDemoUser },
        data: { createdBy: reassign },
      });
      await tx.taskComment.updateMany({
        where: { updatedBy: whereDemoUser },
        data: { updatedBy: reassign },
      });
      await tx.taskAttachment.updateMany({
        where: { createdBy: whereDemoUser },
        data: { createdBy: reassign },
      });
      await tx.taskAttachment.updateMany({
        where: { updatedBy: whereDemoUser },
        data: { updatedBy: reassign },
      });
      await tx.publicTaskShare.updateMany({
        where: { createdBy: whereDemoUser },
        data: { createdBy: reassign },
      });
      await tx.timeEntry.updateMany({
        where: { createdBy: whereDemoUser },
        data: { createdBy: reassign },
      });
      await tx.timeEntry.updateMany({
        where: { updatedBy: whereDemoUser },
        data: { updatedBy: reassign },
      });
      await tx.customField.updateMany({
        where: { createdBy: whereDemoUser },
        data: { createdBy: reassign },
      });
      await tx.customField.updateMany({
        where: { updatedBy: whereDemoUser },
        data: { updatedBy: reassign },
      });
      await tx.notification.updateMany({
        where: { createdBy: whereDemoUser },
        data: { createdBy: reassign },
      });
      await tx.notification.updateMany({
        where: { updatedBy: whereDemoUser },
        data: { updatedBy: reassign },
      });
      await tx.activityLog.updateMany({
        where: { createdBy: whereDemoUser },
        data: { createdBy: reassign },
      });
      await tx.activityLog.updateMany({
        where: { updatedBy: whereDemoUser },
        data: { updatedBy: reassign },
      });
      await tx.automationRule.updateMany({
        where: { createdBy: whereDemoUser },
        data: { createdBy: reassign },
      });
      await tx.automationRule.updateMany({
        where: { updatedBy: whereDemoUser },
        data: { updatedBy: reassign },
      });
      await tx.ruleExecution.updateMany({
        where: { createdBy: whereDemoUser },
        data: { createdBy: reassign },
      });
      await tx.ruleExecution.updateMany({
        where: { updatedBy: whereDemoUser },
        data: { updatedBy: reassign },
      });
      await tx.organizationMember.updateMany({
        where: { createdBy: whereDemoUser },
        data: { createdBy: reassign },
      });
      await tx.organizationMember.updateMany({
        where: { updatedBy: whereDemoUser },
        data: { updatedBy: reassign },
      });
      await tx.workspaceMember.updateMany({
        where: { createdBy: whereDemoUser },
        data: { createdBy: reassign },
      });
      await tx.workspaceMember.updateMany({
        where: { updatedBy: whereDemoUser },
        data: { updatedBy: reassign },
      });
      await tx.projectMember.updateMany({
        where: { createdBy: whereDemoUser },
        data: { createdBy: reassign },
      });
      await tx.projectMember.updateMany({
        where: { updatedBy: whereDemoUser },
        data: { updatedBy: reassign },
      });
      await tx.taskStatusChangeRequest.updateMany({
        where: { reviewedById: whereDemoUser },
        data: { reviewedById: reassign },
      });
      await tx.taskDailyReport.updateMany({
        where: { reviewedById: whereDemoUser },
        data: { reviewedById: reassign },
      });
      await tx.projectInbox.updateMany({
        where: { defaultAssigneeId: whereDemoUser },
        data: { defaultAssigneeId: null },
      });
      await tx.inboxMessage.updateMany({
        where: { convertedBy: whereDemoUser },
        data: { convertedBy: reassign },
      });
      await tx.user.updateMany({
        where: { deletedBy: whereDemoUser },
        data: { deletedBy: reassign },
      });

      const deletedUsers = await tx.user.deleteMany({
        where: { id: whereDemoUser },
      });

      console.log(`Deleted ${deletedUsers.count} demo users.`);
    });

    return {
      deletedUsers: demoUsers.length,
      replacementUser: replacementUser.email,
      deletedEmails: demoUsers.map((user) => user.email),
    };
  }

  async normalizeMekongOrganization() {
    console.log('Normalizing mekong as the only active organization...');

    const owner = await this.prisma.user.findFirst({
      where: { role: Role.SUPER_ADMIN },
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true },
    });

    if (!owner) {
      throw new Error('Cannot normalize organizations because no SUPER_ADMIN user exists.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.upsert({
        where: { slug: 'mekong' },
        update: {
          name: 'mekong',
          description: 'Default organization for Mekong projects',
          website: 'https://mktask.app',
          avatar: null,
          ownerId: owner.id,
          updatedBy: owner.id,
          archive: false,
          settings: {
            allowPublicSignup: false,
            defaultUserRole: 'MEMBER',
            requireEmailVerification: true,
            enableTimeTracking: true,
            enableAutomation: true,
            singleCompanyMode: true,
            timezone: 'UTC',
          },
        },
        create: {
          name: 'mekong',
          slug: 'mekong',
          description: 'Default organization for Mekong projects',
          website: 'https://mktask.app',
          avatar: null,
          ownerId: owner.id,
          createdBy: owner.id,
          updatedBy: owner.id,
          archive: false,
          settings: {
            allowPublicSignup: false,
            defaultUserRole: 'MEMBER',
            requireEmailVerification: true,
            enableTimeTracking: true,
            enableAutomation: true,
            singleCompanyMode: true,
            timezone: 'UTC',
          },
        },
        select: { id: true },
      });

      const workflow = await this.ensureDefaultWorkflow(tx, organization.id, owner.id);

      const workspace = await tx.workspace.upsert({
        where: {
          organizationId_slug: {
            organizationId: organization.id,
            slug: 'projects',
          },
        },
        update: {
          name: 'Projects',
          description: 'Default project workspace for mekong',
          archive: false,
          updatedBy: owner.id,
        },
        create: {
          name: 'Projects',
          slug: 'projects',
          description: 'Default project workspace for mekong',
          organizationId: organization.id,
          createdBy: owner.id,
          updatedBy: owner.id,
          archive: false,
        },
        select: { id: true },
      });

      const users = await tx.user.findMany({
        where: { deletedAt: null },
        select: { id: true, role: true },
      });

      for (const user of users) {
        const role = user.role === Role.SUPER_ADMIN ? Role.SUPER_ADMIN : Role.MEMBER;
        await tx.organizationMember.upsert({
          where: {
            userId_organizationId: {
              userId: user.id,
              organizationId: organization.id,
            },
          },
          update: {
            role,
            isDefault: true,
            updatedBy: owner.id,
          },
          create: {
            userId: user.id,
            organizationId: organization.id,
            role,
            isDefault: true,
            createdBy: owner.id,
            updatedBy: owner.id,
          },
        });

        await tx.workspaceMember.upsert({
          where: {
            userId_workspaceId: {
              userId: user.id,
              workspaceId: workspace.id,
            },
          },
          update: {
            role,
            updatedBy: owner.id,
          },
          create: {
            userId: user.id,
            workspaceId: workspace.id,
            role,
            createdBy: owner.id,
            updatedBy: owner.id,
          },
        });
      }

      await tx.user.updateMany({
        where: { deletedAt: null },
        data: { defaultOrganizationId: organization.id },
      });

      const archivedOrganizations = await tx.organization.updateMany({
        where: {
          id: { not: organization.id },
          archive: false,
        },
        data: { archive: true, updatedBy: owner.id },
      });

      await this.upsertGlobalSetting(
        tx,
        'default_organization_id',
        organization.id,
        'Mekong organization used for all registered users',
        'registration',
      );
      await this.upsertGlobalSetting(
        tx,
        'allow_org_creation',
        'false',
        'Single organization mode disables organization creation',
        'registration',
      );

      return {
        organizationId: organization.id,
        workspaceId: workspace.id,
        workflowId: workflow.id,
        usersUpdated: users.length,
        archivedOrganizations: archivedOrganizations.count,
      };
    });

    console.log(
      `mekong is active. Users updated: ${result.usersUpdated}. Archived organizations: ${result.archivedOrganizations}.`,
    );
    return result;
  }

  private async ensureDefaultWorkflow(
    tx: Prisma.TransactionClient,
    organizationId: string,
    userId: string,
  ) {
    const existingWorkflow = await tx.workflow.findFirst({
      where: { organizationId, isDefault: true },
      include: { statuses: true },
    });

    if (existingWorkflow) return existingWorkflow;

    const workflow = await tx.workflow.create({
      data: {
        name: DEFAULT_WORKFLOW.name,
        description: DEFAULT_WORKFLOW.description,
        isDefault: true,
        organizationId,
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

    const statusMap = new Map(workflow.statuses.map((status) => [status.name, status.id]));
    const transitions = DEFAULT_STATUS_TRANSITIONS.flatMap((transition) => {
      const fromStatusId = statusMap.get(transition.from);
      const toStatusId = statusMap.get(transition.to);
      if (!fromStatusId || !toStatusId) return [];
      return [
        {
          name: `${transition.from} -> ${transition.to}`,
          workflowId: workflow.id,
          fromStatusId,
          toStatusId,
          createdBy: userId,
          updatedBy: userId,
        },
      ];
    });

    if (transitions.length > 0) {
      await tx.statusTransition.createMany({
        data: transitions,
        skipDuplicates: true,
      });
    }

    return workflow;
  }

  private async upsertGlobalSetting(
    tx: Prisma.TransactionClient,
    key: string,
    value: string,
    description: string,
    category: string,
  ) {
    const existing = await tx.settings.findFirst({
      where: { key, userId: null },
    });

    if (existing) {
      await tx.settings.update({
        where: { id: existing.id },
        data: { value, description, category, isEncrypted: false },
      });
      return;
    }

    await tx.settings.create({
      data: { key, value, userId: null, description, category, isEncrypted: false },
    });
  }

  async seedInboxRules() {
    console.log('📧 Starting inbox rules seeding...');

    try {
      const result = await this.inboxRulesSeeder.seedRulesForAllInboxes();
      console.log(
        `✅ Inbox rules seeded: ${result.totalCreated} rules created across ${result.inboxesProcessed} inboxes`,
      );
      return result;
    } catch (_error) {
      console.error('❌ Error seeding inbox rules:', _error);
      throw _error;
    }
  }

  async clearCoreModules() {
    console.log('🧹 Clearing core modules...');

    try {
      // Clear in reverse dependency order to avoid foreign key constraints

      // Clear task-related data first
      await this.timeEntriesSeeder.clear();
      console.log('✅ Time entries cleared');

      await this.taskWatchersSeeder.clear();
      console.log('✅ Task watchers cleared');

      await this.taskDependenciesSeeder.clear();
      console.log('✅ Task dependencies cleared');

      await this.taskCommentsSeeder.clear();
      console.log('✅ Task comments cleared');

      await this.labelsSeeder.clear();
      console.log('✅ Labels cleared');

      await this.sprintsSeeder.clear();
      console.log('✅ Sprints cleared');

      await this.tasksSeeder.clear();
      console.log('✅ Tasks cleared');

      // Clear foundation data
      await this.taskStatusSeeder.clear();
      console.log('✅ Task statuses cleared');

      await this.workflowsSeeder.clear();
      console.log('✅ Workflows cleared');

      await this.projectsSeeder.clear();
      console.log('✅ Projects cleared');

      await this.workspacesSeeder.clear();
      console.log('✅ Workspaces cleared');

      await this.organizationsSeeder.clear();
      console.log('✅ Organizations cleared');

      await this.usersSeeder.clear();
      console.log('✅ Users cleared');

      await this.adminSeeder.clear();

      console.log('✅ Admin user cleared');

      console.log('🎉 Core modules cleared successfully!');
    } catch (_error) {
      console.error('❌ Error clearing core modules:', _error);
      throw _error;
    }
  }
}
