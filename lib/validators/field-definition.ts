import { z } from "zod";

export const FIELD_TYPES = [
  "text",
  "number",
  "date",
  "boolean",
  "dropdown",
  "multiselect",
  "url",
  "phone",
] as const;

export const fieldDefinitionSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z][a-z0-9_]*$/, "Slug huruf kecil, angka, underscore"),
  label: z.string().min(2).max(200),
  tipe: z.enum(FIELD_TYPES),
  optionsJson: z.array(z.string()).optional().default([]),
  isRequired: z.boolean().optional().default(false),
  isSearchable: z.boolean().optional().default(true),
  isActive: z.boolean().optional().default(true),
  visibleInJson: z.array(z.enum(["profil", "list", "export", "api"])).optional().default(["profil", "list", "export"]),
  sortOrder: z.coerce.number().int().optional().default(0),
});

export const updateFieldDefinitionSchema = fieldDefinitionSchema.omit({ slug: true }).partial().extend({
  slug: z.string().optional(),
});
