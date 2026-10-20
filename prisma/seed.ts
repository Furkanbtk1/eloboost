/**
 * Development seed. WIPES every table, then inserts the catalog, price lists,
 * staff/booster/customer accounts and orders covering each order status.
 *
 * Run: npm run db:seed   (also runs after `npm run db:reset`)
 * Every seeded account uses the password in SEED_PASSWORD below.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { PrismaClient } from "../src/generated/prisma/client";
import type { Currency, OrderStatus, OrderType, Prisma } from "../src/generated/prisma/client";
import { encrypt } from "../src/lib/crypto";
import { COMMON_ADD_ONS, GAMES } from "./seed-data/catalog";

if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PRODUCTION !== "true") {
  throw new Error("Refusing to run the seed in production: it deletes all data.");
}

const SEED_PASSWORD = "Password123!";
const BOOSTER_SHARE = 0.6;
const MIN_PAYOUT_USD = 50;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Integer cents -> Decimal string, avoiding float rounding. */
function usd(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Order money fields. The booster/platform split always sums to the total. */
function orderAmounts(subtotalCents: number, discountCents = 0) {
  const totalCents = subtotalCents - discountCents;
  const boosterCents = Math.round(totalCents * BOOSTER_SHARE);
  return {
    subtotal: usd(subtotalCents),
    discountAmount: usd(discountCents),
    totalAmount: usd(totalCents),
    boosterCutAmount: usd(boosterCents),
    platformCutAmount: usd(totalCents - boosterCents),
  };
}

/** Snapshot of a ladder rung as stored in Order.startRank / desiredRank. */
function rank(slug: string, tier: string, division: string | null = null) {
  const step = GAMES.find((g) => g.slug === slug)?.rankSteps?.find(
    (s) => s.tier === tier && s.division === division,
  );
  if (!step) throw new Error(`Unknown rank ${tier} ${division ?? ""} for ${slug}`);
  return { position: step.position, label: division ? `${tier} ${division}` : tier };
}

function daysAgo(days: number, hours = 0): Date {
  return new Date(Date.now() - (days * 24 + hours) * 60 * 60 * 1000);
}

async function truncateAll() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
}

// ---------------------------------------------------------------------------
// Catalog & pricing
// ---------------------------------------------------------------------------

async function seedCatalog() {
  for (const [index, game] of GAMES.entries()) {
    await prisma.game.create({
      data: {
        name: game.name,
        slug: game.slug,
        logoUrl: game.logoUrl,
        rankSystem: game.rankSystem,
        supportedOrderTypes: game.supportedOrderTypes,
        basePrice: game.basePrice,
        coachingHourlyRate: game.coachingHourlyRate,
        sortOrder: index,
        rankSteps: game.rankSteps ? { create: game.rankSteps } : undefined,
        ratingBrackets: game.ratingBrackets ? { create: game.ratingBrackets } : undefined,
        servers: {
          create: game.servers.map((server, sortOrder) => ({ ...server, sortOrder })),
        },
        modifiers: {
          create: [
            ...(game.lpGain ?? []).map((option, sortOrder) => ({
              category: "LP_GAIN" as const,
              key: option.key,
              label: option.label,
              percentage: option.percentage,
              isDefault: option.isDefault ?? false,
              orderTypes: ["DIVISION"] satisfies OrderType[],
              sortOrder,
            })),
            ...COMMON_ADD_ONS.map((addOn, sortOrder) => ({
              category: "ADD_ON" as const,
              key: addOn.key,
              label: addOn.key === "specific_role" ? game.specificRoleLabel : addOn.label,
              description: addOn.description,
              percentage: addOn.percentage,
              // Coaching is priced per hour; only the stream add-on makes sense there.
              orderTypes:
                addOn.key === "live_stream"
                  ? []
                  : game.supportedOrderTypes.filter((type) => type !== "COACHING"),
              sortOrder,
            })),
          ],
        },
      },
    });
  }

  await prisma.setting.createMany({
    data: [
      { key: "booster_commission_rate", value: BOOSTER_SHARE },
      { key: "min_payout_amount_usd", value: MIN_PAYOUT_USD },
      { key: "default_currency", value: "USD" },
      { key: "supported_currencies", value: ["USD", "EUR", "GBP", "TRY"] },
      // Fallback only; live rates are fetched and cached from Sprint 3 on.
      { key: "fallback_exchange_rates_usd", value: { USD: 1, EUR: 1.08, GBP: 1.27, TRY: 0.029 } },
    ],
  });

  const now = Date.now();
  await prisma.promoCode.createMany({
    data: [
      { code: "WELCOME10", discountType: "PERCENTAGE", discountValue: 10, maxUses: 1000, currentUses: 1 },
      {
        code: "SAVE5",
        discountType: "FIXED",
        discountValue: 5,
        minOrderAmount: 30,
        expiresAt: new Date(now + 30 * 24 * 60 * 60 * 1000),
      },
      {
        code: "SUMMER20",
        discountType: "PERCENTAGE",
        discountValue: 20,
        maxUses: 100,
        expiresAt: new Date(now - 24 * 60 * 60 * 1000),
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

async function seedUsers() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);
  const verified = daysAgo(60);

  const [admin, support, finance] = await Promise.all(
    (
      [
        ["admin@eloboost.test", "Super Admin", "ADMIN"],
        ["support@eloboost.test", "Support Manager", "SUPPORT"],
        ["finance@eloboost.test", "Finance Manager", "FINANCE"],
      ] as const
    ).map(([email, name, role]) =>
      prisma.user.create({ data: { email, name, role, passwordHash, emailVerified: verified } }),
    ),
  );

  const boosterSeeds = [
    {
      email: "shadowcarry@eloboost.test",
      name: "ShadowCarry",
      balance: 340,
      status: "ACTIVE",
      games: ["league-of-legends", "teamfight-tactics"],
      currentRanks: {
        "league-of-legends": { position: 30, label: "Challenger" },
        "teamfight-tactics": { position: 29, label: "Grandmaster" },
      },
      payout: { method: "CRYPTO", network: "USDT_TRC20", address: "TQrZ8tKfjjB6Exampl3Wa11etAddr3ss00" },
      totalEarnings: 1250,
      rating: 4.9,
      ratingCount: 87,
      completedOrders: 112,
      languages: ["en", "tr"],
    },
    {
      email: "vandalqueen@eloboost.test",
      name: "VandalQueen",
      balance: 87.5,
      status: "ACTIVE",
      games: ["valorant", "counter-strike-2"],
      currentRanks: {
        valorant: { position: 24, label: "Radiant" },
        "counter-strike-2": { rating: 28500, label: "28,500" },
      },
      payout: { method: "BANK_TRANSFER", iban: "DE89370400440532013000", accountHolder: "Vandal Queen" },
      totalEarnings: 640,
      rating: 4.8,
      ratingCount: 41,
      completedOrders: 52,
      languages: ["en", "de"],
    },
    {
      email: "newcomer@eloboost.test",
      name: "TracerMain",
      balance: 0,
      status: "PENDING_APPROVAL",
      games: ["overwatch-2"],
      currentRanks: { "overwatch-2": { position: 37, label: "Champion 3" } },
      payout: null,
      totalEarnings: 0,
      rating: 0,
      ratingCount: 0,
      completedOrders: 0,
      languages: ["en"],
    },
  ] as const;

  const boosters = [];
  for (const seed of boosterSeeds) {
    const booster = await prisma.user.create({
      data: {
        email: seed.email,
        name: seed.name,
        role: "BOOSTER",
        passwordHash,
        emailVerified: verified,
        balance: seed.balance,
        boosterProfile: {
          create: {
            status: seed.status,
            acceptedGames: { connect: seed.games.map((slug) => ({ slug })) },
            currentRanks: seed.currentRanks,
            totalEarnings: seed.totalEarnings,
            rating: seed.rating,
            ratingCount: seed.ratingCount,
            completedOrders: seed.completedOrders,
            languages: [...seed.languages],
            bio: `${seed.name}: verified high-elo player.`,
          },
        },
      },
    });
    // Payout details are bound to the booster's id (see src/features/payouts/details.ts).
    if (seed.payout) {
      await prisma.boosterProfile.update({
        where: { userId: booster.id },
        data: { payoutDetails: encrypt(JSON.stringify(seed.payout), `payout:${booster.id}`) },
      });
    }
    boosters.push(booster);
  }

  const [alex, elif] = await Promise.all([
    prisma.user.create({
      data: { email: "alex@eloboost.test", name: "Alex Carter", passwordHash, emailVerified: verified },
    }),
    prisma.user.create({
      data: { email: "elif@eloboost.test", name: "Elif Yılmaz", passwordHash, emailVerified: verified },
    }),
  ]);

  return {
    admin,
    support,
    finance,
    shadowCarry: boosters[0],
    vandalQueen: boosters[1],
    tracerMain: boosters[2],
    alex,
    elif,
  };
}

// ---------------------------------------------------------------------------
// Orders & activity
// ---------------------------------------------------------------------------

type OrderSeed = {
  orderNumber: string;
  customerId: string;
  boosterId?: string;
  gameSlug: string;
  orderType: OrderType;
  startRank: Prisma.InputJsonValue;
  desiredRank: Prisma.InputJsonValue;
  currentRank?: Prisma.InputJsonValue;
  quantity?: number;
  server: string;
  region: string;
  amounts: ReturnType<typeof orderAmounts>;
  currency?: Currency;
  exchangeRate?: number;
  status: OrderStatus;
  extraOptions: Prisma.InputJsonValue;
  vpnRequired?: boolean;
  promoCode?: string;
  credentials?: { username: string; password: string };
  timeline: Partial<Record<"createdAt" | "paidAt" | "assignedAt" | "startedAt" | "completedAt" | "cancelledAt", Date>>;
};

async function createOrder(seed: OrderSeed) {
  const order = await prisma.order.create({
    data: {
      orderNumber: seed.orderNumber,
      customer: { connect: { id: seed.customerId } },
      booster: seed.boosterId ? { connect: { id: seed.boosterId } } : undefined,
      game: { connect: { slug: seed.gameSlug } },
      orderType: seed.orderType,
      startRank: seed.startRank,
      desiredRank: seed.desiredRank,
      currentRank: seed.currentRank,
      quantity: seed.quantity,
      server: seed.server,
      region: seed.region,
      ...seed.amounts,
      currency: seed.currency ?? "USD",
      exchangeRate: seed.exchangeRate ?? 1,
      status: seed.status,
      extraOptions: seed.extraOptions,
      vpnRequired: seed.vpnRequired ?? false,
      promoCode: seed.promoCode ? { connect: { code: seed.promoCode } } : undefined,
      ...seed.timeline,
    },
  });

  if (!seed.credentials) return order;

  // Ciphertexts are bound to the order id (AES-GCM associated data).
  return prisma.order.update({
    where: { id: order.id },
    data: {
      accountUsername: encrypt(seed.credentials.username, order.id),
      accountPassword: encrypt(seed.credentials.password, order.id),
    },
  });
}

async function seedOrders(users: Awaited<ReturnType<typeof seedUsers>>) {
  const { admin, finance, shadowCarry, vandalQueen, alex, elif } = users;

  // 1) Paid, waiting in the booster pool.
  const pooled = await createOrder({
    orderNumber: "ELO-10001",
    customerId: alex.id,
    gameSlug: "league-of-legends",
    orderType: "DIVISION",
    startRank: rank("league-of-legends", "Gold", "IV"),
    desiredRank: rank("league-of-legends", "Platinum", "IV"),
    server: "EUW",
    region: "EU",
    amounts: orderAmounts(5280), // 4 divisions x $11, +20% priority
    status: "PENDING",
    extraOptions: { lpGain: "normal_lp", addOns: ["priority"] },
    credentials: { username: "alexc_euw", password: "S3cure-Lol-Pass!" },
    timeline: { createdAt: daysAgo(0, 3), paidAt: daysAgo(0, 3) },
  });

  // 2) Being played right now.
  const inProgress = await createOrder({
    orderNumber: "ELO-10002",
    customerId: alex.id,
    boosterId: shadowCarry.id,
    gameSlug: "league-of-legends",
    orderType: "DIVISION",
    startRank: rank("league-of-legends", "Diamond", "IV"),
    desiredRank: rank("league-of-legends", "Diamond", "I"),
    currentRank: rank("league-of-legends", "Diamond", "III"),
    server: "EUNE",
    region: "EU",
    amounts: orderAmounts(12300), // 35 + 40 + 48
    status: "IN_PROGRESS",
    extraOptions: { lpGain: "normal_lp", addOns: ["offline_mode"] },
    vpnRequired: true,
    credentials: { username: "alexc_main", password: "D1amond-Grind#2026" },
    timeline: { createdAt: daysAgo(2), paidAt: daysAgo(2), assignedAt: daysAgo(1, 20), startedAt: daysAgo(1, 18) },
  });

  // 3) Finished, reviewed and tipped.
  const completed = await createOrder({
    orderNumber: "ELO-10003",
    customerId: elif.id,
    boosterId: vandalQueen.id,
    gameSlug: "valorant",
    orderType: "WIN",
    startRank: rank("valorant", "Gold", "2"),
    desiredRank: rank("valorant", "Gold", "2"),
    quantity: 5,
    server: "EU",
    region: "EU",
    amounts: orderAmounts(2500), // 5 wins x $4, +25% live stream
    status: "COMPLETED",
    extraOptions: { lpGain: "normal_rr", addOns: ["live_stream"] },
    credentials: { username: "elifyilmaz#TR1", password: "Val0rant!Elif" },
    timeline: {
      createdAt: daysAgo(9),
      paidAt: daysAgo(9),
      assignedAt: daysAgo(8, 22),
      startedAt: daysAgo(8, 20),
      completedAt: daysAgo(7),
    },
  });

  // 4) Created but not paid yet (EUR checkout).
  const unpaid = await createOrder({
    orderNumber: "ELO-10004",
    customerId: elif.id,
    gameSlug: "counter-strike-2",
    orderType: "DIVISION",
    startRank: { rating: 9000 },
    desiredRank: { rating: 12000 },
    server: "NA",
    region: "NA",
    amounts: orderAmounts(10694), // $115.50 (25 + 80, +10% NA) at 1.08 USD/EUR
    currency: "EUR",
    exchangeRate: 1.08,
    status: "AWAITING_PAYMENT",
    extraOptions: { addOns: [] },
    timeline: { createdAt: daysAgo(0, 1) },
  });

  // 5) Disputed placement order, bought with a promo code.
  const disputed = await createOrder({
    orderNumber: "ELO-10005",
    customerId: alex.id,
    boosterId: shadowCarry.id,
    gameSlug: "league-of-legends",
    orderType: "PLACEMENT",
    startRank: rank("league-of-legends", "Gold", "I"),
    desiredRank: rank("league-of-legends", "Gold", "I"),
    quantity: 5,
    server: "EUW",
    region: "EU",
    amounts: orderAmounts(2500, 250), // 5 games x $5, WELCOME10
    status: "DISPUTED",
    extraOptions: { addOns: [] },
    promoCode: "WELCOME10",
    credentials: { username: "alexc_smurf", password: "Pl4cements!" },
    timeline: { createdAt: daysAgo(5), paidAt: daysAgo(5), assignedAt: daysAgo(4, 20), startedAt: daysAgo(4, 18) },
  });

  // 6) Cancelled and refunded (TRY checkout via PayTR).
  const cancelled = await createOrder({
    orderNumber: "ELO-10006",
    customerId: elif.id,
    gameSlug: "teamfight-tactics",
    orderType: "DIVISION",
    startRank: rank("teamfight-tactics", "Silver", "I"),
    desiredRank: rank("teamfight-tactics", "Gold", "IV"),
    server: "TR",
    region: "EU",
    amounts: orderAmounts(19310), // $5.60 at 0.029 USD/TRY
    currency: "TRY",
    exchangeRate: 0.029,
    status: "CANCELLED",
    extraOptions: { lpGain: "normal_lp", addOns: [] },
    timeline: { createdAt: daysAgo(12), paidAt: daysAgo(12), cancelledAt: daysAgo(11) },
  });

  // Ledger -------------------------------------------------------------------
  await prisma.transaction.createMany({
    data: [
      { orderId: pooled.id, userId: alex.id, type: "PAYMENT", amount: pooled.totalAmount, currency: "USD", gateway: "STRIPE", gatewayTransactionId: "cs_test_seed_10001", status: "COMPLETED", createdAt: daysAgo(0, 3) },
      { orderId: inProgress.id, userId: alex.id, type: "PAYMENT", amount: inProgress.totalAmount, currency: "USD", gateway: "PAYPAL", gatewayTransactionId: "PAYID-SEED-10002", status: "COMPLETED", createdAt: daysAgo(2) },
      { orderId: completed.id, userId: elif.id, type: "PAYMENT", amount: completed.totalAmount, currency: "USD", gateway: "COINBASE", gatewayTransactionId: "CB-SEED-10003", status: "COMPLETED", createdAt: daysAgo(9) },
      { orderId: completed.id, userId: vandalQueen.id, type: "EARNING", amount: completed.boosterCutAmount, currency: "USD", gateway: "WALLET", status: "COMPLETED", createdAt: daysAgo(7) },
      { orderId: completed.id, userId: vandalQueen.id, type: "TIP", amount: "2.50", currency: "USD", gateway: "STRIPE", gatewayTransactionId: "cs_test_seed_tip_10003", status: "COMPLETED", metadata: { fromUserId: elif.id, percent: 10 }, createdAt: daysAgo(7) },
      { orderId: unpaid.id, userId: elif.id, type: "PAYMENT", amount: unpaid.totalAmount, currency: "EUR", gateway: "STRIPE", gatewayTransactionId: "cs_test_seed_10004", status: "PENDING", createdAt: daysAgo(0, 1) },
      { orderId: disputed.id, userId: alex.id, type: "PAYMENT", amount: disputed.totalAmount, currency: "USD", gateway: "STRIPE", gatewayTransactionId: "cs_test_seed_10005", status: "COMPLETED", createdAt: daysAgo(5) },
      { orderId: cancelled.id, userId: elif.id, type: "PAYMENT", amount: cancelled.totalAmount, currency: "TRY", gateway: "PAYTR", gatewayTransactionId: "PAYTR-SEED-10006", status: "COMPLETED", createdAt: daysAgo(12) },
      { orderId: cancelled.id, userId: elif.id, type: "REFUND", amount: cancelled.totalAmount, currency: "TRY", gateway: "PAYTR", gatewayTransactionId: "PAYTR-SEED-10006-R", status: "COMPLETED", createdAt: daysAgo(11) },
    ],
  });

  // Payouts ------------------------------------------------------------------
  await prisma.payoutRequest.create({
    data: {
      booster: { connect: { id: shadowCarry.id } },
      amount: 120,
      method: "CRYPTO",
      destination: encrypt(
        JSON.stringify({ method: "CRYPTO", network: "USDT_TRC20", address: "TQrZ8tKfjjB6Exampl3Wa11etAddr3ss00" }),
        `payout:${shadowCarry.id}`,
      ),
      status: "PENDING",
      createdAt: daysAgo(1),
    },
  });

  const paidPayout = await prisma.payoutRequest.create({
    data: {
      booster: { connect: { id: vandalQueen.id } },
      amount: 50,
      method: "BANK_TRANSFER",
      destination: encrypt(
        JSON.stringify({ method: "BANK_TRANSFER", iban: "DE89370400440532013000", accountHolder: "Vandal Queen" }),
        `payout:${vandalQueen.id}`,
      ),
      status: "PAID",
      reviewedBy: { connect: { id: finance.id } },
      reviewedAt: daysAgo(3),
      createdAt: daysAgo(4),
    },
  });

  await prisma.transaction.create({
    data: {
      user: { connect: { id: vandalQueen.id } },
      payoutRequest: { connect: { id: paidPayout.id } },
      type: "PAYOUT",
      amount: 50,
      currency: "USD",
      gateway: "MANUAL",
      gatewayTransactionId: "SEPA-SEED-0001",
      status: "COMPLETED",
      createdAt: daysAgo(3),
    },
  });

  // Chat, review, dispute, credential access ----------------------------------
  await prisma.message.createMany({
    data: [
      { orderId: inProgress.id, senderId: alex.id, content: "Hi! Please avoid playing jungle if possible.", isRead: true, createdAt: daysAgo(1, 19) },
      { orderId: inProgress.id, senderId: shadowCarry.id, content: "No problem, I'll stick to mid and ADC. Starting tonight at 20:00 CET.", isRead: true, createdAt: daysAgo(1, 18) },
      { orderId: inProgress.id, senderId: shadowCarry.id, content: "Diamond III reached, 7W-1L so far.", isRead: false, createdAt: daysAgo(0, 2) },
      { orderId: disputed.id, senderId: alex.id, content: "4 losses out of 5 placement games? This is not what I paid for.", isRead: true, createdAt: daysAgo(3) },
      { orderId: disputed.id, senderId: shadowCarry.id, content: "Two of those games had AFK teammates, I can send screenshots.", isRead: false, createdAt: daysAgo(3) },
    ],
  });

  await prisma.review.create({
    data: {
      order: { connect: { id: completed.id } },
      customer: { connect: { id: elif.id } },
      booster: { connect: { id: vandalQueen.id } },
      rating: 5,
      comment: "Super fast, 5/5 wins and the stream was fun to watch.",
      isPublic: true,
      createdAt: daysAgo(7),
    },
  });

  await prisma.dispute.create({
    data: {
      order: { connect: { id: disputed.id } },
      openedBy: { connect: { id: alex.id } },
      reason: "Booster lost 4 of 5 placement games. Requesting a partial refund.",
      previousStatus: "IN_PROGRESS",
      createdAt: daysAgo(3),
    },
  });

  await prisma.credentialAccessLog.create({
    data: {
      order: { connect: { id: inProgress.id } },
      booster: { connect: { id: shadowCarry.id } },
      vpnLocation: "Frankfurt, DE",
      ipAddress: "203.0.113.24",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      createdAt: daysAgo(1, 18),
    },
  });

  // Notifications & audit ----------------------------------------------------
  await prisma.notification.createMany({
    data: [
      { userId: alex.id, type: "ORDER_UPDATE", data: { orderNumber: "ELO-10002", status: "IN_PROGRESS" }, link: "/dashboard/orders/ELO-10002", isRead: true, createdAt: daysAgo(1, 18) },
      { userId: alex.id, type: "NEW_MESSAGE", data: { orderNumber: "ELO-10002", from: "ShadowCarry" }, link: "/dashboard/orders/ELO-10002", createdAt: daysAgo(0, 2) },
      { userId: shadowCarry.id, type: "DISPUTE_UPDATE", data: { orderNumber: "ELO-10005", status: "OPEN" }, link: "/booster/orders/ELO-10005", createdAt: daysAgo(3) },
      { userId: vandalQueen.id, type: "PAYOUT_UPDATE", data: { amount: 50, status: "PAID" }, link: "/booster/payouts", isRead: true, createdAt: daysAgo(3) },
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      { adminId: admin.id, action: "booster.approve", targetType: "User", targetId: shadowCarry.id, createdAt: daysAgo(90) },
      { adminId: admin.id, action: "booster.approve", targetType: "User", targetId: vandalQueen.id, createdAt: daysAgo(60) },
      { adminId: admin.id, action: "promo.create", targetType: "PromoCode", targetId: "WELCOME10", details: { discountType: "PERCENTAGE", discountValue: 10 }, createdAt: daysAgo(30) },
      { adminId: admin.id, action: "order.refund", targetType: "Order", targetId: cancelled.id, details: { amount: cancelled.totalAmount.toString(), currency: "TRY" }, createdAt: daysAgo(11) },
      { adminId: finance.id, action: "payout.mark_paid", targetType: "PayoutRequest", targetId: paidPayout.id, createdAt: daysAgo(3) },
    ],
  });
}

// ---------------------------------------------------------------------------

async function main() {
  console.log("Seeding database...");
  await truncateAll();
  await seedCatalog();
  const users = await seedUsers();
  await seedOrders(users);

  const counts = await Promise.all([
    prisma.game.count(),
    prisma.rankStep.count(),
    prisma.priceModifier.count(),
    prisma.user.count(),
    prisma.order.count(),
    prisma.transaction.count(),
  ]);
  console.log(
    `Done: ${counts[0]} games, ${counts[1]} rank steps, ${counts[2]} modifiers, ` +
      `${counts[3]} users, ${counts[4]} orders, ${counts[5]} transactions.`,
  );
  console.log(`All seeded accounts use the password: ${SEED_PASSWORD}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
