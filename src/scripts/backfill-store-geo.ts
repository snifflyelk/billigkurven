import { prisma } from "@/lib/prisma";
import { resolvePostalCodeCoordinates, sanitizePostalCode } from "@/lib/geo";

type StoreRow = {
  id: string;
  name: string;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
};

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value ?? "");
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

async function main() {
  const limit = parsePositiveInt(process.env.STORE_GEO_BACKFILL_LIMIT, 2000);

  const stores = await prisma.store.findMany({
    where: {
      OR: [{ latitude: null }, { longitude: null }],
      postalCode: { not: null },
    },
    orderBy: { name: "asc" },
    take: limit,
    select: {
      id: true,
      name: true,
      postalCode: true,
      latitude: true,
      longitude: true,
    },
  });

  if (stores.length === 0) {
    console.log("No stores missing geo coordinates.");
    return;
  }

  const postalCodes = Array.from(
    new Set(
      stores
        .map((store) => sanitizePostalCode(store.postalCode))
        .filter((postalCode) => postalCode.length === 4),
    ),
  );

  const coordinatesByPostalCode = new Map<string, { latitude: number; longitude: number } | null>();

  for (const postalCode of postalCodes) {
    const coordinates = await resolvePostalCodeCoordinates(postalCode);
    coordinatesByPostalCode.set(postalCode, coordinates);
  }

  let updated = 0;
  let skippedInvalidPostal = 0;
  let skippedMissingCoordinates = 0;

  for (const store of stores as StoreRow[]) {
    const postalCode = sanitizePostalCode(store.postalCode);
    if (postalCode.length !== 4) {
      skippedInvalidPostal += 1;
      continue;
    }

    const coordinates = coordinatesByPostalCode.get(postalCode) ?? null;
    if (!coordinates) {
      skippedMissingCoordinates += 1;
      continue;
    }

    await prisma.store.update({
      where: { id: store.id },
      data: {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      },
    });
    updated += 1;
  }

  console.log(`Processed: ${stores.length}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (invalid postal): ${skippedInvalidPostal}`);
  console.log(`Skipped (no coordinates found): ${skippedMissingCoordinates}`);
}

main()
  .catch((error) => {
    console.error("Store geo backfill failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
