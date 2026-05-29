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
  const allowedChains = readListArg("--chains");
  const productIds = readListArg("--productIds");
  const maxProductsRaw = readArg("--maxProducts");
  const maxProducts = maxProductsRaw ? Number(maxProductsRaw) : undefined;

  const result = await syncLivePrices(prisma, {
    allowedChains,
    productIds,
    maxProducts: Number.isFinite(maxProducts) ? maxProducts : undefined,
  });

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });