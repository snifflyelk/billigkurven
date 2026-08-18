-- Fallback manual index rollout when psql is unavailable.
-- NOTE: No CONCURRENTLY here because prisma db execute runs in a transaction.

CREATE INDEX IF NOT EXISTS "Price_isQuarantined_date_idx"
  ON "Price" ("isQuarantined", "date");

CREATE INDEX IF NOT EXISTS "Price_storeId_isQuarantined_date_idx"
  ON "Price" ("storeId", "isQuarantined", "date");

CREATE INDEX IF NOT EXISTS "Price_productId_isQuarantined_date_idx"
  ON "Price" ("productId", "isQuarantined", "date");

CREATE INDEX IF NOT EXISTS "Price_isQuarantined_date_storeId_idx"
  ON "Price" ("isQuarantined", "date", "storeId");

CREATE INDEX IF NOT EXISTS "PriceAlert_userId_isActive_idx"
  ON "PriceAlert" ("userId", "isActive");

CREATE INDEX IF NOT EXISTS "ShoppingList_userId_createdAt_idx"
  ON "ShoppingList" ("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "ShoppingListItem_productId_idx"
  ON "ShoppingListItem" ("productId");

CREATE INDEX IF NOT EXISTS "ReceiptSubmission_status_reviewedAt_idx"
  ON "ReceiptSubmission" ("status", "reviewedAt");

CREATE INDEX IF NOT EXISTS "ReceiptSubmission_userId_status_reviewedAt_idx"
  ON "ReceiptSubmission" ("userId", "status", "reviewedAt");

CREATE INDEX IF NOT EXISTS "User_createdAt_idx"
  ON "User" ("createdAt");
