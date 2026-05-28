const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const managers = await prisma.user.findMany({ where: { role: 'MANAGER' } });
  console.log(managers.map(m => m.email));
}
main().catch(console.error).finally(() => prisma.$disconnect());
