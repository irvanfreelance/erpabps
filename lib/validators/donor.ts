import { z } from "zod";

export const createDonorSchema = z.object({
  noHpCanonical: z.string().min(8),
  namaLengkap: z.string().min(2),
  email: z.string().email().optional().nullable(),
  statusKontak: z.string().optional(),
  tags: z.array(z.string()).optional(),
  assignedTo: z.string().optional().nullable(),
});

export const updateDonorSchema = createDonorSchema.partial();

export const assignSchema = z.object({
  donorIds: z.array(z.string()).min(1),
  assignedTo: z.string().nullable(),
});

export const prospectNoteSchema = z.object({
  donorId: z.string(),
  campaignId: z.string().optional().nullable(),
  tglProspek: z.string().optional(),
  channel: z.string().optional(),
  responDonatur: z.string().optional().nullable(),
  catatanBebas: z.string().optional().nullable(),
  source: z.string().optional(),
});

export const searchSchema = z.object({
  match: z.enum(["and", "or"]).optional().default("and"),
  conditions: z.array(
    z.object({
      field: z.string(),
      op: z.enum(["eq", "contains", "gte", "lte", "contains_all", "contains_any"]),
      value: z.string(),
    }),
  ),
});
