import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_USER_EMAIL } from "@/lib/constants";
import { badRequest, serverError } from "@/lib/api-response";

export async function GET() {
  try {
    const receipts = await prisma.receiptSubmission.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: true,
      },
    });

    return NextResponse.json({ receipts });
  } catch (error) {
    return serverError(error, "Kunne ikke hente kvitteringer i admin.");
  }
}

export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const body = await request.json();

    if (!id) {
      return badRequest("Mangler id.", "Send id som query parameter.");
    }

    const reviewedBy = body.reviewedBy ? String(body.reviewedBy) : DEFAULT_USER_EMAIL;

    const receipt = await prisma.receiptSubmission.update({
      where: { id },
      data: {
        status: body.status === "REJECTED" ? "REJECTED" : "REVIEWED",
        detectedStore: body.detectedStore ? String(body.detectedStore) : undefined,
        detectedTotal: body.detectedTotal ? Number(body.detectedTotal) : undefined,
        notes: body.notes ? String(body.notes) : undefined,
        reviewedAt: new Date(),
        reviewedBy,
      },
    });

    return NextResponse.json({ receipt });
  } catch (error) {
    return serverError(error, "Kunne ikke oppdatere kvittering i admin.");
  }
}
