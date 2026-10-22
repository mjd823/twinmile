import { z } from "zod";

export const ConvertQuoteLeadSchema = z.object({
  createLoad: z.boolean().default(true),
  contractName: z.string().min(1).max(140).optional(),
  rateType: z.enum(["flat", "per_mile", "hourly"]),
  rateUsd: z.number().finite().positive().max(100000000),
  agreedRateReviewed: z.literal(true),
});
