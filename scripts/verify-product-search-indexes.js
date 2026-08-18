const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const expected = [
  "Product_name_idx",
  "Product_brand_idx",
  "Product_category_idx",
  "Product_updatedAt_idx",
  "Product_name_trgm_idx",
  "Product_brand_trgm_idx",
  "Product_category_trgm_idx",
];

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN (
        'Product_name_idx',
        'Product_brand_idx',
        'Product_category_idx',
        'Product_updatedAt_idx',
        'Product_name_trgm_idx',
        'Product_brand_trgm_idx',
        'Product_category_trgm_idx'
      )
    ORDER BY indexname
  `);

  const found = rows.map((row) => row.indexname);
  const missing = expected.filter((name) => !found.includes(name));

  console.log("Found indexes:", found);
  console.log("Missing indexes:", missing);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
