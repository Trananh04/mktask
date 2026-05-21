import { NestFactory } from '@nestjs/core';
import { SeederModule } from './seeder.module';
import { SeederService } from './seeder.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SeederModule);
  const seederService = app.get(SeederService);

  const command = process.argv[2] || 'seed';

  try {
    switch (command) {
      case 'seed':
        console.log('Starting core modules seeding (idempotent)...\n');
        await seederService.seedCoreModules();
        console.log('\nCore modules seeding completed successfully!');
        break;

      case 'admin':
        console.log('Starting admin modules seeding (idempotent)...\n');
        await seederService.adminSeedModules();
        console.log('\nAdmin modules seeding completed successfully!');
        break;

      case 'clear':
        console.log('Starting core modules clearing...\n');
        await seederService.clearCoreModules();
        console.log('\nCore modules clearing completed successfully!');
        break;

      case 'clear-demo-users':
        console.log('Starting demo user cleanup...\n');
        await seederService.clearDemoUsers();
        console.log('\nDemo user cleanup completed successfully!');
        break;

      case 'reset':
        console.log('Starting core modules reset...\n');
        await seederService.clearCoreModules();
        console.log('Existing data cleared\n');
        await seederService.seedCoreModules();
        console.log('\nCore modules reset completed successfully!');
        break;

      default:
        console.log(`
Seeder Commands:

  npm run seed                  - Seed core modules (idempotent)
  npm run seed:admin            - Seed admin user only (idempotent)
  npm run seed:clear            - Clear all core modules data
  npm run seed:clear-demo-users - Remove seeded demo users only
  npm run seed:reset            - Clear and re-seed core modules

All seed commands are idempotent and safe to run multiple times.
        `);
        break;
    }
  } catch (_error) {
    console.error('\nError:', _error.message);
    process.exit(1);
  } finally {
    await app.close();
  }
}

void bootstrap();
