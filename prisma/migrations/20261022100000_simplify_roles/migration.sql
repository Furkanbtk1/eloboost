-- Support and finance duties now belong to ADMIN. Existing staff accounts keep working as admins.
UPDATE "User" SET "role" = 'ADMIN' WHERE "role" IN ('SUPPORT', 'FINANCE');

ALTER TYPE "UserRole" RENAME TO "UserRole_old";
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'BOOSTER', 'ADMIN');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole" USING ("role"::text::"UserRole");
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'CUSTOMER';
DROP TYPE "UserRole_old";
