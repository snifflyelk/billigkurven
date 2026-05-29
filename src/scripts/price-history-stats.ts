import { prisma } from "@/lib/prisma";

async function main() {
  const [totalPrices, pricesLast24h, bySource] = await Promise.all([
    prisma.price.count(),
    prisma.price.count({
      where: {
        date: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.price.groupBy({
      by: ["source"],
      _count: { _all: true },
      orderBy: {
        _count: {
          source: "desc",
        },
      },
    }),
  ]);

  console.log(
    JSON.stringify(
      {
        totalPrices,
        pricesLast24h,
        bySource,
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
