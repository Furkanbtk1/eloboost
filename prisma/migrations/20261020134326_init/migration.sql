-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'BOOSTER', 'SUPPORT', 'FINANCE', 'ADMIN');

-- CreateEnum
CREATE TYPE "BoosterStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "RankSystem" AS ENUM ('DIVISION', 'RATING');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('DIVISION', 'WIN', 'PLACEMENT', 'COACHING');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('AWAITING_PAYMENT', 'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'EUR', 'GBP', 'TRY');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DEPOSIT', 'PAYMENT', 'EARNING', 'TIP', 'PAYOUT', 'REFUND');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentGateway" AS ENUM ('STRIPE', 'PAYPAL', 'COINBASE', 'NOWPAYMENTS', 'XSOLLA', 'G2A', 'PAYTR', 'IYZICO', 'SKRILL', 'ALIPAY', 'WALLET', 'MANUAL');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "ModifierCategory" AS ENUM ('LP_GAIN', 'ADD_ON');

-- CreateEnum
CREATE TYPE "PayoutMethod" AS ENUM ('CRYPTO', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PAID');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "DisputeResolution" AS ENUM ('REFUNDED', 'PARTIAL_REFUND', 'REASSIGNED', 'CONTINUED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ORDER_UPDATE', 'NEW_MESSAGE', 'PAYOUT_UPDATE', 'DISPUTE_UPDATE', 'SYSTEM');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "passwordHash" TEXT,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "avatarUrl" TEXT,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "is2FAEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "stripeCustomerId" TEXT,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "id" UUID NOT NULL,
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoosterProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "currentRanks" JSONB NOT NULL DEFAULT '{}',
    "payoutDetails" TEXT,
    "status" "BoosterStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "totalEarnings" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "rating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "completedOrders" INTEGER NOT NULL DEFAULT 0,
    "bio" TEXT,
    "languages" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoosterProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "status" "GameStatus" NOT NULL DEFAULT 'ACTIVE',
    "rankSystem" "RankSystem" NOT NULL,
    "supportedOrderTypes" "OrderType"[],
    "basePrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "coachingHourlyRate" DECIMAL(10,2),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankStep" (
    "id" UUID NOT NULL,
    "gameId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "tier" TEXT NOT NULL,
    "division" TEXT,
    "iconUrl" TEXT,
    "divisionPrice" DECIMAL(10,2),
    "winPrice" DECIMAL(10,2) NOT NULL,
    "placementPrice" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "RankStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RatingBracket" (
    "id" UUID NOT NULL,
    "gameId" UUID NOT NULL,
    "minRating" INTEGER NOT NULL,
    "maxRating" INTEGER NOT NULL,
    "pricePer100" DECIMAL(10,2) NOT NULL,
    "winPrice" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "RatingBracket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameServer" (
    "id" UUID NOT NULL,
    "gameId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "priceModifier" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GameServer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceModifier" (
    "id" UUID NOT NULL,
    "gameId" UUID NOT NULL,
    "category" "ModifierCategory" NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "percentage" DECIMAL(5,2) NOT NULL,
    "orderTypes" "OrderType"[],
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PriceModifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoCode" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" "DiscountType" NOT NULL,
    "discountValue" DECIMAL(10,2) NOT NULL,
    "maxUses" INTEGER,
    "currentUses" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "minOrderAmount" DECIMAL(10,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerId" UUID NOT NULL,
    "boosterId" UUID,
    "gameId" UUID NOT NULL,
    "orderType" "OrderType" NOT NULL,
    "startRank" JSONB NOT NULL,
    "desiredRank" JSONB NOT NULL,
    "currentRank" JSONB,
    "quantity" INTEGER,
    "server" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "boosterCutAmount" DECIMAL(12,2) NOT NULL,
    "platformCutAmount" DECIMAL(12,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "exchangeRate" DECIMAL(18,8) NOT NULL DEFAULT 1,
    "status" "OrderStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "accountUsername" TEXT,
    "accountPassword" TEXT,
    "extraOptions" JSONB NOT NULL DEFAULT '{}',
    "vpnRequired" BOOLEAN NOT NULL DEFAULT false,
    "promoCodeId" UUID,
    "notes" TEXT,
    "paidAt" TIMESTAMP(3),
    "assignedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" UUID NOT NULL,
    "orderId" UUID,
    "userId" UUID NOT NULL,
    "payoutRequestId" UUID,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" "Currency" NOT NULL,
    "gateway" "PaymentGateway" NOT NULL,
    "gatewayTransactionId" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "boosterId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CredentialAccessLog" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "boosterId" UUID NOT NULL,
    "vpnLocation" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CredentialAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "openedById" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" "DisputeResolution",
    "adminNote" TEXT,
    "previousStatus" "OrderStatus" NOT NULL,
    "resolvedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutRequest" (
    "id" UUID NOT NULL,
    "boosterId" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PayoutMethod" NOT NULL,
    "destination" TEXT NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "adminId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_BoosterProfileToGame" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_BoosterProfileToGame_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "BoosterProfile_userId_key" ON "BoosterProfile"("userId");

-- CreateIndex
CREATE INDEX "BoosterProfile_status_idx" ON "BoosterProfile"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Game_slug_key" ON "Game"("slug");

-- CreateIndex
CREATE INDEX "Game_status_sortOrder_idx" ON "Game"("status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "RankStep_gameId_position_key" ON "RankStep"("gameId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "RatingBracket_gameId_minRating_key" ON "RatingBracket"("gameId", "minRating");

-- CreateIndex
CREATE UNIQUE INDEX "GameServer_gameId_code_key" ON "GameServer"("gameId", "code");

-- CreateIndex
CREATE INDEX "PriceModifier_gameId_category_idx" ON "PriceModifier"("gameId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "PriceModifier_gameId_key_key" ON "PriceModifier"("gameId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_status_gameId_idx" ON "Order"("status", "gameId");

-- CreateIndex
CREATE INDEX "Order_customerId_createdAt_idx" ON "Order"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_boosterId_status_idx" ON "Order"("boosterId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_payoutRequestId_key" ON "Transaction"("payoutRequestId");

-- CreateIndex
CREATE INDEX "Transaction_userId_createdAt_idx" ON "Transaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_orderId_idx" ON "Transaction"("orderId");

-- CreateIndex
CREATE INDEX "Transaction_type_status_idx" ON "Transaction"("type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_gateway_gatewayTransactionId_key" ON "Transaction"("gateway", "gatewayTransactionId");

-- CreateIndex
CREATE INDEX "Message_orderId_createdAt_idx" ON "Message"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_orderId_key" ON "Review"("orderId");

-- CreateIndex
CREATE INDEX "Review_boosterId_isPublic_idx" ON "Review"("boosterId", "isPublic");

-- CreateIndex
CREATE INDEX "CredentialAccessLog_orderId_createdAt_idx" ON "CredentialAccessLog"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "Dispute_status_createdAt_idx" ON "Dispute"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Dispute_orderId_idx" ON "Dispute"("orderId");

-- CreateIndex
CREATE INDEX "PayoutRequest_status_createdAt_idx" ON "PayoutRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PayoutRequest_boosterId_idx" ON "PayoutRequest"("boosterId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");

-- CreateIndex
CREATE INDEX "AuditLog_adminId_createdAt_idx" ON "AuditLog"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "_BoosterProfileToGame_B_index" ON "_BoosterProfileToGame"("B");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoosterProfile" ADD CONSTRAINT "BoosterProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankStep" ADD CONSTRAINT "RankStep_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingBracket" ADD CONSTRAINT "RatingBracket_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameServer" ADD CONSTRAINT "GameServer_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceModifier" ADD CONSTRAINT "PriceModifier_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_boosterId_fkey" FOREIGN KEY ("boosterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_payoutRequestId_fkey" FOREIGN KEY ("payoutRequestId") REFERENCES "PayoutRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_boosterId_fkey" FOREIGN KEY ("boosterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialAccessLog" ADD CONSTRAINT "CredentialAccessLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialAccessLog" ADD CONSTRAINT "CredentialAccessLog_boosterId_fkey" FOREIGN KEY ("boosterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_boosterId_fkey" FOREIGN KEY ("boosterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BoosterProfileToGame" ADD CONSTRAINT "_BoosterProfileToGame_A_fkey" FOREIGN KEY ("A") REFERENCES "BoosterProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BoosterProfileToGame" ADD CONSTRAINT "_BoosterProfileToGame_B_fkey" FOREIGN KEY ("B") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- Integrity guards that Prisma schema cannot express (added by hand).
-- -----------------------------------------------------------------------------

ALTER TABLE "User" ADD CONSTRAINT "User_balance_non_negative" CHECK ("balance" >= 0);

ALTER TABLE "BoosterProfile" ADD CONSTRAINT "BoosterProfile_rating_range" CHECK ("rating" >= 0 AND "rating" <= 5);

ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_range" CHECK ("rating" BETWEEN 1 AND 5);

ALTER TABLE "RatingBracket" ADD CONSTRAINT "RatingBracket_range_valid" CHECK ("maxRating" > "minRating");

ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_discount_valid" CHECK (
  "discountValue" > 0 AND ("discountType" <> 'PERCENTAGE' OR "discountValue" <= 100)
);
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_uses_valid" CHECK (
  "currentUses" >= 0 AND ("maxUses" IS NULL OR "currentUses" <= "maxUses")
);

ALTER TABLE "Order" ADD CONSTRAINT "Order_amounts_valid" CHECK (
  "subtotal" >= 0 AND "discountAmount" >= 0 AND "totalAmount" >= 0
  AND "boosterCutAmount" >= 0 AND "platformCutAmount" >= 0
  AND "boosterCutAmount" + "platformCutAmount" = "totalAmount"
);

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_amount_positive" CHECK ("amount" > 0);

ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_amount_positive" CHECK ("amount" > 0);
