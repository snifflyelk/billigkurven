import { z } from "zod";

export const searchProductsSchema = z.object({
  q: z.string().min(1).max(100),
});

export const shoppingListSchema = z.object({
  userId: z.string().min(1),
});

export const shoppingListItemCreateSchema = z.object({
  shoppingListId: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(100),
});

export const shoppingListItemUpdateSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().int().min(1).max(100),
});

export const compareSchema = z.object({
  shoppingListId: z.string().min(1),
  postalPrefix: z.string().trim().regex(/^\d{2,4}$/).optional(),
  postalCode: z.string().trim().regex(/^\d{4}$/).optional(),
  travelMode: z.enum(["DRIVE", "WALK"]).optional(),
  maxTravelMinutes: z.number().int().min(1).max(240).optional(),
  maxTravelKm: z.number().min(1).max(300).optional(),
});

export const userPreferenceSchema = z.object({
  userId: z.string().min(1),
  postalCode: z.string().regex(/^\d{4}$/).nullable().optional(),
  postalPrefix: z.string().regex(/^\d$/).nullable().optional(),
  travelMode: z.enum(["DRIVE", "WALK"]).optional(),
  maxTravelMinutes: z.number().int().min(1).max(240).nullable().optional(),
  maxTravelKm: z.number().min(1).max(300).nullable().optional(),
  primaryStore: z.string().min(1).max(120),
  priceSensitivity: z.number().int().min(0).max(100),
  useMembershipPricing: z.boolean().optional(),
  shoppingTripBudget: z.number().int().min(0).max(100000).nullable().optional(),
  weeklyGroceryBudget: z.number().int().min(0).max(100000).nullable().optional(),
});

export const adminProductSchema = z.object({
  name: z.string().min(2).max(120),
  brand: z.string().min(1).max(120),
  ean: z.string().min(8).max(32),
  category: z.string().min(1).max(120),
  imageUrl: z.string().url().optional().or(z.literal("")),
  packageQuantity: z.number().positive().max(100000).nullable().optional(),
  packageUnit: z.enum(["G", "ML", "STK"]).nullable().optional(),
});

export const adminPriceSchema = z.object({
  productId: z.string().min(1),
  storeId: z.string().min(1),
  price: z.number().positive(),
  unitPrice: z.number().positive(),
  promoPrice: z.number().positive().nullable().optional(),
  loyaltyPrice: z.number().positive().nullable().optional(),
  promoLabel: z.string().max(120).nullable().optional(),
  promoValidFrom: z.string().datetime().nullable().optional(),
  promoValidTo: z.string().datetime().nullable().optional(),
  requiresMembership: z.boolean().optional(),
  date: z.string().datetime().optional(),
});
