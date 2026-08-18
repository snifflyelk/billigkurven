const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const expected = [
  "Price_isQuarantined_date_idx",
  "Price_storeId_isQuarantined_date_idx",
  "Price_productId_isQuarantined_date_idx",
  "Price_isQuarantined_date_storeId_idx",
  "PriceAlert_userId_isActive_idx",
  "ShoppingList_userId_createdAt_idx",
  "ShoppingListItem_productId_idx",
  "ReceiptSubmission_status_reviewedAt_idx",
  "ReceiptSubmission_userId_status_reviewedAt_idx",
  "User_createdAt_idx",
];

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = ANY($1)
    ORDER BY indexname;
  `, expected);

  const found = rows.map((row) => row.indexname);
  const missing = expected.filter((name) => !found.includes(name));

  console.log("Found indexes:", found);
  console.log("Missing indexes:", missing);

  if (missing.length > 0) {
    process.exitCode = 2;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
