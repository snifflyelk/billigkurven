import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, serverError } from "@/lib/api-response";
import { buildReceiptSavingsInsight } from "@/lib/verified-savings";
import { getOrCreateSessionUserId } from "@/lib/user-session";

async function buildProductCandidates() {
  const products = await prisma.product.findMany({
    include: {
      prices: {
        include: { store: true },
        where: { isQuarantined: false },
        orderBy: { date: "desc" },
      },
    },
    take: 400,
  });

  return products.map((product) => {
    const latestByStore = new Map<string, { storeId: string; storeName: string; price: number }>();
    for (const price of product.prices) {
      if (latestByStore.has(price.storeId)) continue;
      latestByStore.set(price.storeId, {
        storeId: price.storeId,
        storeName: price.store.name,
        price: Number(price.price),
      });
    }

    return {
      id: product.id,
      name: product.name,
      brand: product.brand,
      prices: Array.from(latestByStore.values()),
    };
  });
}

export async function GET() {
  try {
    const userId = await getOrCreateSessionUserId();
    const receipts = await prisma.receiptSubmission.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ receipts });
  } catch (error) {
    return serverError(error, "Kunne ikke hente kvitteringer akkurat na.");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId = await getOrCreateSessionUserId();
    const fileName = String(body.fileName ?? "kvittering.png");

    if (!fileName.trim()) {
      return badRequest("Ugyldig filnavn.", "Send fileName i request body.");
    }

    const productCandidates = await buildProductCandidates();
    const insight = buildReceiptSavingsInsight(
      {
        detectedStore: body.detectedStore ? String(body.detectedStore) : null,
        detectedTotal: body.detectedTotal ? Number(body.detectedTotal) : null,
        recognizedItems: body.recognizedItems ?? null,
      },
      productCandidates,
    );

    const receipt = await prisma.receiptSubmission.create({
      data: {
        userId,
        fileName,
        imageDataUrl: body.imageDataUrl ? String(body.imageDataUrl) : null,
        recognizedText: body.recognizedText ? String(body.recognizedText) : null,
        recognizedItems: body.recognizedItems ?? null,
        detectedStore: body.detectedStore ? String(body.detectedStore) : null,
        detectedTotal: body.detectedTotal ? Number(body.detectedTotal) : null,
        estimatedCheapestTotal: insight.estimatedCheapestTotal,
        estimatedDetectedStoreTotal: insight.estimatedDetectedStoreTotal,
        verifiedSavings: insight.verifiedSavings,
        matchedItems: insight.matchedItems,
        totalItems: insight.totalItems,
        savingsConfidence: insight.confidence,
        savingsNote: insight.note,
        savingsComputedAt: new Date(),
        notes: body.notes ? String(body.notes) : null,
      },
    });

    return NextResponse.json({ receipt }, { status: 201 });
  } catch (error) {
    return serverError(error, "Kunne ikke lagre kvittering. Kontroller payload og prov igjen.");
  }
}
