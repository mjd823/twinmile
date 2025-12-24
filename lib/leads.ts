import { z } from "zod";

export const QuoteLeadSchema = z.object({
  name: z.string().min(1).max(120),
  company: z.string().max(200).optional().or(z.literal("")),
  email: z.string().email(),
  phone: z.string().min(7).max(30),
  pickupLocation: z.string().min(2).max(200),
  dropoffLocation: z.string().min(2).max(200),
  serviceType: z.string().min(1).max(80),
  pickupDate: z.string().max(40).optional().or(z.literal("")),
  notes: z.string().max(4000).optional().or(z.literal("")),
  hp: z.string().optional().or(z.literal("")),
});

export type QuoteLeadInput = z.infer<typeof QuoteLeadSchema>;

export const DriverLeadSchema = z.object({
  fullName: z.string().min(1).max(120),
  email: z.string().email(),
  phone: z.string().min(7).max(30),
  truckType: z.string().min(1).max(120),
  yearsExperience: z.string().max(40).optional().or(z.literal("")),
  preferredRoutes: z.string().max(200).optional().or(z.literal("")),
  startDate: z.string().max(40).optional().or(z.literal("")),
  notes: z.string().max(4000).optional().or(z.literal("")),
  hp: z.string().optional().or(z.literal("")),
});

export type DriverLeadInput = z.infer<typeof DriverLeadSchema>;
