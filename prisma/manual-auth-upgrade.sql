-- Auth/account migration without prisma migrate reset

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;

ALTER TABLE "UserPreference"
  ADD COLUMN IF NOT EXISTS "postalPrefix" TEXT;
