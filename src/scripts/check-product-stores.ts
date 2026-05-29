import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const nameContains = process.argv[2] ?? "lettmelk";
  const product = await prisma.product.findFirst({
    where: { name: { contains: nameContains, mode: "insensitive" } },
    select: { id: true, name: true },
  });

  if (!product) {
    console.log(JSON.stringify({ ok: false, reason: "product-not-found", nameContains }, null, 2));
    return;
  }

  const rows = await prisma.price.findMany({
    where: { productId: product.id, isQuarantined: false },
    include: { store: true },
    orderBy: { date: "desc" },
    take: 200,
  });

  const latestByStore = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!latestByStore.has(row.storeId)) latestByStore.set(row.storeId, row);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        product,
        rows: rows.length,
        stores: Array.from(latestByStore.values()).map((row) => ({
          store: row.store.name,
          chain: row.store.chain,
          source: row.source,
          sourceUrl: row.sourceUrl,
          observedAt: row.date,
          price: Number(row.price),
        })),
        sources: Array.from(new Set(rows.map((row) => row.source))),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
