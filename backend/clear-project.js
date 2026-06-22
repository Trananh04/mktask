const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find workspaces with name "Projects" or slug "mekong"
  const workspaces = await prisma.workspace.findMany({
    where: { OR: [{ slug: 'mekong' }, { slug: 'projects' }] }
  });

  if (workspaces.length === 0) {
    console.log("No default workspaces found.");
    return;
  }

  for (const ws of workspaces) {
    console.log(`Deleting members for workspace: ${ws.id} - ${ws.name}`);
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: ws.id }
    });
    
    // Also delete any tasks/lists/boards/etc inside it before deleting the workspace?
    // It's safer to just remove all workspace members so the user doesn't see it!
  }

  console.log("All workspace members of the default projects have been removed.");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
