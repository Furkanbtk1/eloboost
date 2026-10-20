import { z } from "zod";

import { Currency, OrderType } from "@/generated/prisma/enums";
import { POINTS_BUCKET_KEYS } from "@/features/pricing/engine";

/** Calculator selection as sent by the browser. Prices are never accepted from it. */
export const quoteInputSchema = z.object({
  orderType: z.enum(OrderType),
  current: z.number().int().min(0).max(100_000),
  target: z.number().int().min(0).max(100_000),
  currentPoints: z.enum(POINTS_BUCKET_KEYS),
  quantity: z.number().int().min(1).max(100),
  server: z.string().min(1).max(20),
  lpGain: z.string().min(1).max(40).nullable(),
  addOns: z.array(z.string().min(1).max(40)).max(10),
});

export const createOrderSchema = z.object({
  gameSlug: z.string().min(1).max(60),
  config: quoteInputSchema,
  currency: z.enum(Currency),
  promoCode: z.string().trim().toUpperCase().max(30).optional(),
  /**
   * Total the customer saw, in cents of `currency`. Only compared with the
   * server's own price so a stale or tampered page can't check out silently.
   */
  expectedTotalCents: z.number().int().min(0),
});

export type CreateOrderInput = z.input<typeof createOrderSchema>;

export const promoCodeSchema = z.string().trim().toUpperCase().min(2).max(30).regex(/^[A-Z0-9_-]+$/);
