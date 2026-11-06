import { z } from "zod";

export const tagSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z][a-z0-9_]*$/)
    .optional(),
  nama: z.string().min(1).max(120),
  warna: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  deskripsi: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const donorTagPatchSchema = z.object({
  add: z.string().min(1).optional(),
  remove: z.string().min(1).optional(),
});
