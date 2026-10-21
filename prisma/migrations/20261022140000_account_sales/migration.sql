-- Selling ready-made game accounts: products (what is for sale) and stock (the actual logins).
ALTER TYPE "OrderType" ADD VALUE 'ACCOUNT';

CREATE TYPE "AccountKind" AS ENUM ('ACCOUNT', 'SMURF');

CREATE TABLE "AccountProduct" (
    "id" UUID NOT NULL,
    "gameId" UUID NOT NULL,
    "kind" "AccountKind" NOT NULL,
    "serverCode" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "level" INTEGER,
    "championCount" INTEGER NOT NULL,
    "hasMailAccess" BOOLEAN NOT NULL DEFAULT false,
    "price" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountProduct_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AccountProduct_price_positive" CHECK ("price" > 0),
    CONSTRAINT "AccountProduct_champions_valid" CHECK ("championCount" >= 0)
);

CREATE TABLE "AccountStock" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "credentials" TEXT NOT NULL,
    "orderId" UUID,
    "soldAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountStock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountStock_orderId_key" ON "AccountStock"("orderId");
CREATE INDEX "AccountStock_productId_orderId_idx" ON "AccountStock"("productId", "orderId");
CREATE INDEX "AccountProduct_gameId_kind_serverCode_idx" ON "AccountProduct"("gameId", "kind", "serverCode");

ALTER TABLE "AccountProduct" ADD CONSTRAINT "AccountProduct_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountStock" ADD CONSTRAINT "AccountStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "AccountProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountStock" ADD CONSTRAINT "AccountStock_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
