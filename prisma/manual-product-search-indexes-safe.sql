-- Product search/filter indexes for /varer server-side pagination and filtering.
-- Uses non-CONCURRENT index creation so it can run via prisma db execute in transaction mode.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- B-tree indexes for equality filters and sorting
CREATE INDEX IF NOT EXISTS "Product_name_idx" ON "Product"("name");
CREATE INDEX IF NOT EXISTS "Product_brand_idx" ON "Product"("brand");
CREATE INDEX IF NOT EXISTS "Product_category_idx" ON "Product"("category");
CREATE INDEX IF NOT EXISTS "Product_updatedAt_idx" ON "Product"("updatedAt");

-- Trigram indexes for ILIKE '%query%' contains search on name/brand/category
CREATE INDEX IF NOT EXISTS "Product_name_trgm_idx" ON "Product" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Product_brand_trgm_idx" ON "Product" USING gin ("brand" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Product_category_trgm_idx" ON "Product" USING gin ("category" gin_trgm_ops);
