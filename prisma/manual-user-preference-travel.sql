ALTER TABLE "UserPreference"
  ADD COLUMN IF NOT EXISTS "postalCode" TEXT,
  ADD COLUMN IF NOT EXISTS "travelMode" TEXT NOT NULL DEFAULT 'DRIVE',
  ADD COLUMN IF NOT EXISTS "maxTravelMinutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "maxTravelKm" DOUBLE PRECISION;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'UserPreference_travelMode_check'
  ) THEN
    ALTER TABLE "UserPreference"
      ADD CONSTRAINT "UserPreference_travelMode_check"
      CHECK ("travelMode" IN ('DRIVE', 'WALK'));
  END IF;
END $$;
