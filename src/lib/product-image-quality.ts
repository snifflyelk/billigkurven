import { prisma } from "@/lib/prisma";
import { syncLivePrices } from "@/lib/live-pricing/sync";
import { isLikelyImageForProduct, isLikelyProductImageUrl } from "@/lib/live-pricing/providers/media";

export type ProductImageReviewCandidate = {
  id: string;
  name: string;
  brand: string;
  ean: string;
  category: string;
  imageUrl: string | null;
  reason: "missing" | "invalid-url" | "possible-mismatch";
};

function detectReason(product: {
  imageUrl: string | null;
  name: string;
  brand: string;
  ean: string;
}): ProductImageReviewCandidate["reason"] | null {
  if (!product.imageUrl) return "missing";
  if (!isLikelyProductImageUrl(product.imageUrl)) return "invalid-url";
  if (!isLikelyImageForProduct(product.imageUrl, { name: product.name, brand: product.brand, ean: product.ean })) {
    return "possible-mismatch";
  }
  return null;
}

export async function listProductImageReviewCandidates(limit = 120): Promise<ProductImageReviewCandidate[]> {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      brand: true,
      ean: true,
      category: true,
      imageUrl: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: Math.max(limit * 4, 240),
  });

  const candidates: ProductImageReviewCandidate[] = [];

  for (const product of products) {
    const reason = detectReason(product);
    if (!reason) continue;
    candidates.push({
      id: product.id,
      name: product.name,
      brand: product.brand,
      ean: product.ean,
      category: product.category,
      imageUrl: product.imageUrl,
      reason,
    });

    if (candidates.length >= limit) break;
  }

  return candidates;
}

export async function runProductImageRefreshJob(limit = 80) {
  const candidates = await listProductImageReviewCandidates(limit);
  const productIds = candidates.map((candidate) => candidate.id);

  if (productIds.length === 0) {
    return {
      attemptedProducts: 0,
      refreshedCandidates: 0,
      remainingCandidates: 0,
      syncResult: null,
    };
  }

  const syncResult = await syncLivePrices(prisma, {
    productIds,
    maxProducts: Math.max(limit, 20),
  });

  const remainingCandidates = await listProductImageReviewCandidates(limit);

  return {
    attemptedProducts: productIds.length,
    refreshedCandidates: Math.max(0, candidates.length - remainingCandidates.length),
    remainingCandidates: remainingCandidates.length,
    syncResult,
  };
}
