import { z } from "zod";

export const ROLES = ["admin", "supervisor", "data_analyst", "tim_blast", "read_only"] as const;

export const createUserSchema = z.object({
  nama: z.string().min(2).max(200),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  role: z.enum(ROLES).default("tim_blast"),
  isActive: z.boolean().optional().default(true),
});

export const updateUserSchema = z.object({
  nama: z.string().min(2).max(200).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).max(100).optional().or(z.literal("")),
  role: z.enum(ROLES).optional(),
  isActive: z.boolean().optional(),
});
