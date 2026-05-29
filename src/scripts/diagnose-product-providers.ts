import { prisma } from "@/lib/prisma";
import { syncLivePrices } from "@/lib/live-pricing/sync";

function readArg(prefix: string) {
  const hit = process.argv.find((arg) => arg.startsWith(`${prefix}=`));
  return hit ? hit.slice(prefix.length + 1) : undefined;
}

function readListArg(prefix: string) {
  const raw = readArg(prefix);
  if (!raw) return undefined;
  const values = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return values.length > 0 ? values : undefined;
}

async function main() {
  const productContains = readArg("--productContains") ?? "lettmelk";
  const chains = readListArg("--chains") ?? ["MENY", "SPAR", "Joker"];

  const product = await prisma.product.findFirst({
    where: { name: { contains: productContains, mode: "insensitive" } },
    select: { id: true, name: true },
  });

  if (!product) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          reason: "product-not-found",
          productContains,
        },
        null,
        2,
      ),
    );
    return;
  }

  const result = await syncLivePrices(prisma, {
    allowedChains: chains,
    productIds: [product.id],
    maxProducts: 1,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        product,
        chains,
        matchedPrices: result.matchedPrices,
        providerMetrics: result.providerMetrics,
        rows: result.results,
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
