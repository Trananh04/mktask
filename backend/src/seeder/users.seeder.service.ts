import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, UserStatus, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersSeederService {
  constructor(private prisma: PrismaService) {}

  async seed() {
    console.log('🌱 Seeding users...');

    const hashedPassword = await bcrypt.hash('password123', 10);

    const usersData = [
      {
        email: 'admin@mktask.app',
        username: 'admin',
        firstName: 'Admin',
        lastName: 'User',
        role: Role.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        password: hashedPassword,
        emailVerified: true,
        bio: 'System administrator with full access to all features',
        timezone: 'UTC',
        language: 'en',
        mobileNumber: '+10000000001',
      },
    ];

    const createdUsers: User[] = [];
    for (const userData of usersData) {
      try {
        const user = await this.prisma.user.create({
          data: {
            ...userData,
            preferences: {
              theme: 'light',
              notifications: {
                email: true,
                push: true,
                desktop: true,
              },
              dashboard: {
                showCompletedTasks: false,
                defaultView: 'list',
              },
            },
          },
        });
        createdUsers.push(user);
        console.log(`   ✓ Created user: ${user.email}`);
      } catch (error) {
        console.error(error);
        console.log(`   ⚠ User ${userData.email} might already exist, skipping...`);
        // Try to find existing user
        const existingUser = await this.prisma.user.findUnique({
          where: { email: userData.email },
        });
        if (existingUser) {
          createdUsers.push(existingUser);
        }
      }
    }

    console.log(`✅ Users seeding completed. Created/Found ${createdUsers.length} users.`);
    return createdUsers;
  }

  async clear() {
    console.log('🧹 Clearing users...');

    try {
      const deletedCount = await this.prisma.user.deleteMany();
      console.log(`✅ Deleted ${deletedCount.count} users`);
    } catch (_error) {
      console.error('❌ Error clearing users:', _error);
      throw _error;
    }
  }

  findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        bio: true,
        mobileNumber: true,
        timezone: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });
  }
}
