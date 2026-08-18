ALTER TABLE "Store"
  ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS "Store_latitude_longitude_idx" ON "Store"("latitude", "longitude");
