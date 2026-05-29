import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncLivePrices } from "@/lib/live-pricing/sync";
import { badRequest, serverError } from "@/lib/api-response";

export async function GET() {
  try {
    const priorities = await prisma.coveragePriority.findMany({
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 200,
    });

    return NextResponse.json({ priorities });
  } catch (error) {
    return serverError(error, "Kunne ikke hente dekningsprioriteringer.");
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      scopeType?: "CHAIN" | "POSTAL_CODE";
      scopeKey?: string;
      title?: string;
      status?: "OPEN" | "IN_PROGRESS" | "BLOCKED" | "RESOLVED";
      owner?: string | null;
      notes?: string | null;
    };

    if (!body.scopeType || !body.scopeKey || !body.title) {
      return badRequest("Ugyldig prioritet.", "Send scopeType, scopeKey og title.");
    }

    const priority = await prisma.coveragePriority.upsert({
      where: {
        scopeType_scopeKey: {
          scopeType: body.scopeType,
          scopeKey: body.scopeKey,
        },
      },
      update: {
        title: body.title,
        status: body.status ?? "OPEN",
        owner: body.owner?.trim() || null,
        notes: body.notes?.trim() || null,
      },
      create: {
        scopeType: body.scopeType,
        scopeKey: body.scopeKey,
        title: body.title,
        status: body.status ?? "OPEN",
        owner: body.owner?.trim() || null,
        notes: body.notes?.trim() || null,
      },
    });

    return NextResponse.json({ priority }, { status: 201 });
  } catch (error) {
    return serverError(error, "Kunne ikke lagre dekningsprioritet.");
  }
}

export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const body = (await request.json()) as {
      status?: "OPEN" | "IN_PROGRESS" | "BLOCKED" | "RESOLVED";
      owner?: string | null;
      notes?: string | null;
      action?: "run-sync";
    };

    if (!id) {
      return badRequest("Mangler id.", "Send id som query parameter.");
    }

    const existingPriority = await prisma.coveragePriority.findUnique({
      where: { id },
    });

    if (!existingPriority) {
      return badRequest("Fant ikke prioritet.", "Kontroller at id er gyldig.");
    }

    let actionData:
      | {
          lastActionType: string;
          lastActionAt: Date;
          lastActionSummary: string;
        }
      | undefined;

    if (body.action === "run-sync") {
      let targetDescription = "global";
      let options: { allowedChains?: string[]; productIds?: string[] } | undefined;

      if (existingPriority.scopeType === "CHAIN") {
        targetDescription = `kjede ${existingPriority.scopeKey}`;
        options = { allowedChains: [existingPriority.scopeKey] };
      }

      if (existingPriority.scopeType === "POSTAL_CODE") {
        targetDescription = `postnummer ${existingPriority.scopeKey}`;

        const scopedStores = await prisma.store.findMany({
          where: {
            OR: [
              { postalCode: { startsWith: existingPriority.scopeKey } },
              { location: { contains: existingPriority.scopeKey, mode: "insensitive" } },
            ],
          },
          select: {
            chain: true,
            prices: {
              select: { productId: true },
              orderBy: { date: "desc" },
              take: 500,
            },
          },
          take: 200,
        });

        const chains = Array.from(new Set(scopedStores.map((store) => store.chain.trim()).filter(Boolean)));
        const productIds = Array.from(new Set(scopedStores.flatMap((store) => store.prices.map((price) => price.productId))));

        options = {
          allowedChains: chains.length ? chains : undefined,
          productIds: productIds.length ? productIds : undefined,
        };
      }

      const result = await syncLivePrices(prisma, options);
      actionData = {
        lastActionType: "sync-live-prices",
        lastActionAt: new Date(),
        lastActionSummary: `Synk kjort for ${targetDescription}: ${result.matchedPrices} prislinjer, ${result.productsEvaluated} produkter, ${result.providersEvaluated} kilder.`,
      };
    }

    const priority = await prisma.coveragePriority.update({
      where: { id },
      data: {
        ...(body.status ? { status: body.status } : {}),
        ...(body.owner !== undefined ? { owner: body.owner?.trim() || null } : {}),
        ...(body.notes !== undefined ? { notes: body.notes?.trim() || null } : {}),
        ...(actionData ?? {}),
      },
    });

    return NextResponse.json({ priority });
  } catch (error) {
    return serverError(error, "Kunne ikke oppdatere dekningsprioritet.");
  }
}