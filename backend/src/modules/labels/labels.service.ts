import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Label } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';
import { AssignLabelDto, AssignMultipleLabelsDto } from './dto/assign-label.dto';

@Injectable()
export class LabelsService {
  constructor(private prisma: PrismaService) {}

  private async checkProjectAccess(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        workspace: {
          include: { members: { where: { userId } } },
        },
        members: { where: { userId } },
        tasks: {
          where: {
            OR: [
              { createdBy: userId },
              { assignees: { some: { userId } } },
              { reporters: { some: { userId } } },
            ],
          },
          take: 1,
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const isWorkspaceMember = project.workspace.members.length > 0;
    const isProjectMember = project.members.length > 0;
    const isTaskInvolved = project.tasks.length > 0;

    if (!isWorkspaceMember && !isProjectMember && !isTaskInvolved) {
      throw new ForbiddenException('You do not have permission to access labels in this project');
    }

    return project;
  }

  async create(createLabelDto: CreateLabelDto, userId: string): Promise<Label> {
    const project = await this.checkProjectAccess(createLabelDto.projectId, userId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const label = await tx.label.create({
          data: {
            ...createLabelDto,
            createdBy: userId,
            updatedBy: userId,
          },
          include: {
            project: {
              select: {
                id: true,
                name: true,
                slug: true,
                workspace: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    organization: {
                      select: {
                        id: true,
                        name: true,
                        slug: true,
                      },
                    },
                  },
                },
              },
            },
            createdByUser: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
            updatedByUser: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
            _count: {
              select: {
                taskLabels: true,
              },
            },
          },
        });

        // Add label to WorkspaceLabel join table for workspace-level tracking
        await tx.workspaceLabel.create({
          data: {
            workspaceId: project.workspaceId,
            labelId: label.id,
          },
        });

        return label;
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Label with this name already exists in this project');
      }
      throw error;
    }
  }

  async findAll(projectId: string | undefined, userId: string): Promise<Label[]> {
    const whereClause: any = {};

    if (projectId) {
      const project = await this.checkProjectAccess(projectId, userId);

      whereClause.OR = [
        { project: { workspaceId: project.workspaceId } },
        { workspaceLabels: { some: { workspaceId: project.workspaceId } } },
      ];
    } else {
      // If no projectId, get all labels from projects user has access to
      const accessibleProjects = await this.prisma.project.findMany({
        where: {
          workspace: {
            members: {
              some: { userId },
            },
          },
        },
        select: { id: true },
      });

      whereClause.projectId = { in: accessibleProjects.map((p) => p.id) };
    }

    return this.prisma.label.findMany({
      where: whereClause,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            slug: true,
            workspace: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        _count: {
          select: {
            taskLabels: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findOne(id: string, userId: string) {
    const label = await this.prisma.label.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            workspace: {
              include: {
                members: {
                  where: { userId },
                  select: { role: true },
                },
              },
            },
          },
        },
        taskLabels: {
          include: {
            task: {
              select: {
                id: true,
                title: true,
                slug: true,
                type: true,
                priority: true,
                status: {
                  select: {
                    id: true,
                    name: true,
                    color: true,
                    category: true,
                  },
                },
                assignees: {
                  select: {
                    user: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        avatar: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            taskLabels: true,
          },
        },
      },
    });

    if (!label) {
      throw new NotFoundException('Label not found');
    }

    await this.checkProjectAccess(label.projectId, userId);

    // Flatten nested assignees for API backward compatibility
    return {
      ...label,
      taskLabels: label.taskLabels?.map((tl) => ({
        ...tl,
        task: tl.task
          ? {
              ...tl.task,
              assignees: tl.task.assignees?.map((a: { user?: unknown }) => a.user ?? a),
            }
          : tl.task,
      })),
    };
  }

  async update(id: string, updateLabelDto: UpdateLabelDto, userId: string): Promise<Label> {
    // Verify label exists and user has access
    const label = await this.prisma.label.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            workspace: {
              include: {
                members: {
                  where: { userId },
                  select: { role: true },
                },
              },
            },
          },
        },
      },
    });

    if (!label) {
      throw new NotFoundException('Label not found');
    }

    await this.checkProjectAccess(label.projectId, userId);

    try {
      const updatedLabel = await this.prisma.label.update({
        where: { id },
        data: {
          ...updateLabelDto,
          updatedBy: userId,
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              slug: true,
              workspace: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
          createdByUser: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          updatedByUser: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: {
              taskLabels: true,
            },
          },
        },
      });

      return updatedLabel;
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Label with this name already exists in this project');
      }
      if (error.code === 'P2025') {
        throw new NotFoundException('Label not found');
      }
      throw error;
    }
  }

  async remove(id: string, userId: string): Promise<void> {
    // Verify label exists and user has access
    const label = await this.prisma.label.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            workspace: {
              include: {
                members: {
                  where: { userId },
                  select: { role: true },
                },
              },
            },
          },
        },
      },
    });

    if (!label) {
      throw new NotFoundException('Label not found');
    }

    await this.checkProjectAccess(label.projectId, userId);

    try {
      await this.prisma.label.delete({
        where: { id },
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException('Label not found');
      }
      throw error;
    }
  }

  // Task Label Management
  async assignLabelToTask(assignLabelDto: AssignLabelDto, userId: string): Promise<void> {
    const { taskId, labelId } = assignLabelDto;

    // Verify task and label exist and user has access
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId);
    const task = await this.prisma.task.findFirst({
      where: isUuid ? { id: taskId } : { slug: taskId },
      include: {
        project: {
          include: {
            workspace: {
              include: {
                members: {
                  where: { userId },
                  select: { role: true },
                },
              },
            },
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    await this.checkProjectAccess(task.projectId, userId);

    const label = await this.prisma.label.findUnique({
      where: { id: labelId },
      include: {
        project: { select: { workspaceId: true } },
        workspaceLabels: { where: { workspaceId: task.project.workspaceId } },
      },
    });

    if (!label) {
      throw new NotFoundException('Label not found');
    }

    if (
      task.project.workspaceId !== label.project.workspaceId &&
      label.workspaceLabels.length === 0
    ) {
      throw new ConflictException(
        'Task and label must belong to the same workspace or be inherited',
      );
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.taskLabel.create({
          data: {
            taskId: task.id,
            labelId,
          },
        });

        await tx.workspaceLabel.upsert({
          where: {
            workspaceId_labelId: {
              workspaceId: task.project.workspaceId,
              labelId,
            },
          },
          update: {},
          create: {
            workspaceId: task.project.workspaceId,
            labelId,
          },
        });
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Label is already assigned to this task');
      }
      throw error;
    }
  }

  async removeLabelFromTask(taskId: string, labelId: string, userId: string): Promise<void> {
    // Verify task exists and user has access
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId);
    const task = await this.prisma.task.findFirst({
      where: isUuid ? { id: taskId } : { slug: taskId },
      include: {
        project: {
          include: {
            workspace: {
              include: {
                members: {
                  where: { userId },
                  select: { role: true },
                },
              },
            },
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    await this.checkProjectAccess(task.projectId, userId);

    try {
      await this.prisma.taskLabel.delete({
        where: {
          taskId_labelId: {
            taskId: task.id,
            labelId,
          },
        },
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException('Label assignment not found');
      }
      throw error;
    }
  }

  async assignMultipleLabelsToTask(
    assignMultipleLabelsDto: AssignMultipleLabelsDto,
    userId: string,
  ): Promise<void> {
    const { taskId, labelIds } = assignMultipleLabelsDto;

    // Validate labelIds array is not empty
    if (!labelIds || labelIds.length === 0) {
      throw new BadRequestException('labelIds array cannot be empty');
    }

    // Verify task exists and user has access
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId);
    const task = await this.prisma.task.findFirst({
      where: isUuid ? { id: taskId } : { slug: taskId },
      include: {
        project: {
          include: {
            workspace: {
              include: {
                members: {
                  where: { userId },
                  select: { role: true },
                },
              },
            },
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    await this.checkProjectAccess(task.projectId, userId);

    // Verify all labels exist and belong to the same workspace or are inherited
    const labels = await this.prisma.label.findMany({
      where: {
        id: { in: labelIds },
        OR: [
          { project: { workspaceId: task.project.workspaceId } },
          { workspaceLabels: { some: { workspaceId: task.project.workspaceId } } },
        ],
      },
      select: { id: true },
    });

    if (labels.length !== labelIds.length) {
      throw new NotFoundException(
        'One or more labels not found or do not belong to the same workspace',
      );
    }

    // Remove existing labels and add new ones
    await this.prisma.$transaction(async (tx) => {
      // Remove existing labels
      await tx.taskLabel.deleteMany({
        where: { taskId: task.id },
      });

      // Add new labels
      if (labelIds.length > 0) {
        await tx.taskLabel.createMany({
          data: labelIds.map((labelId) => ({
            taskId: task.id,
            labelId,
          })),
        });

        // Track used labels at the workspace level
        await tx.workspaceLabel.createMany({
          data: labelIds.map((labelId) => ({
            workspaceId: task.project.workspaceId,
            labelId,
          })),
          skipDuplicates: true,
        });
      }
    });
  }

  async getTaskLabels(taskId: string, userId: string): Promise<Label[]> {
    // Verify task exists and user has access
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId);
    const task = await this.prisma.task.findFirst({
      where: isUuid ? { id: taskId } : { slug: taskId },
      include: {
        project: {
          include: {
            workspace: {
              include: {
                members: {
                  where: { userId },
                  select: { role: true },
                },
              },
            },
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    await this.checkProjectAccess(task.projectId, userId);

    const taskLabels = await this.prisma.taskLabel.findMany({
      where: { taskId: task.id },
      include: {
        label: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    return taskLabels.map((tl) => tl.label);
  }
}
