const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const workspaces = await prisma.workspace.findMany({
    where: { OR: [{ slug: 'mekong' }, { slug: 'projects' }] }
  });

  for (const ws of workspaces) {
    console.log(`Deleting workspace: ${ws.slug}`);
    
    // Get all projects in the workspace
    const projects = await prisma.project.findMany({
      where: { workspaceId: ws.id }
    });

    for (const project of projects) {
      console.log(`Deleting project: ${project.name}`);
      // Tasks, TaskMembers, etc. should cascade, but to be safe, we can try to delete the project.
      // If it fails due to foreign keys, we delete tasks first.
      await prisma.project.delete({ where: { id: project.id } }).catch(e => {
         console.log("Failed to delete project directly, might need to delete tasks first.");
      });
    }

    // Delete the workspace
    await prisma.workspace.delete({ where: { id: ws.id } }).catch(e => {
        console.log("Failed to delete workspace directly.");
    });
  }

  console.log("Deleted default workspaces.");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
