import { runProductImageRefreshJob } from "@/lib/product-image-quality";
import { prisma } from "@/lib/prisma";

async function main() {
  const limitArg = process.argv[2] ? Number(process.argv[2]) : 80;
  const limit = Number.isFinite(limitArg) ? Math.max(10, Math.min(250, Math.round(limitArg))) : 80;

  const result = await runProductImageRefreshJob(limit);

  console.log("Image refresh result:", {
    attemptedProducts: result.attemptedProducts,
    refreshedCandidates: result.refreshedCandidates,
    remainingCandidates: result.remainingCandidates,
    matchedPrices: result.syncResult?.matchedPrices ?? 0,
    productsEvaluated: result.syncResult?.productsEvaluated ?? 0,
  });
}

main()
  .catch((error) => {
    console.error("Image refresh failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
