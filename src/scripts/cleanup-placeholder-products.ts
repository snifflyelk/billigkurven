import { prisma } from "@/lib/prisma";

async function main() {
  const beforeRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "Product"
    WHERE "name" ~* '^vare\\s+[0-9]+$'
  `;

  const before = Number(beforeRows[0]?.count ?? 0);
  if (before === 0) {
    console.log("No placeholder products found.");
    return;
  }

  const deleted = await prisma.$executeRaw`
    DELETE FROM "Product"
    WHERE "name" ~* '^vare\\s+[0-9]+$'
  `;

  const afterRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "Product"
    WHERE "name" ~* '^vare\\s+[0-9]+$'
  `;

  const after = Number(afterRows[0]?.count ?? 0);
  console.log(`Placeholder products before cleanup: ${before}`);
  console.log(`Deleted products: ${deleted}`);
  console.log(`Placeholder products remaining: ${after}`);
}

main()
  .catch((error) => {
    console.error("Failed to cleanup placeholder products", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
