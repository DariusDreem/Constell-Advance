import { z } from "zod";

const id = z.guid();

export const domainSchema = z.object({
  id,
  name: z.string().trim().min(1, "Donne un nom au domaine.").max(40, "40 caractères maximum."),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  position: z.number().int().min(0).max(999),
});

export const starSchema = z
  .object({
    id,
    domainId: id,
    secondaryDomainId: id.nullable(),
    title: z.string().trim().min(1, "Donne un titre au palier.").max(80, "80 caractères maximum."),
    description: z.string().trim().max(2000, "2 000 caractères maximum."),
    tier: z.enum(["major", "minor"]),
    achievedAt: z.iso.datetime().nullable(),
    currentValue: z.number().min(0, "La valeur actuelle ne peut pas être négative.").nullable(),
    targetValue: z.number().positive("L'objectif doit être supérieur à zéro.").nullable(),
    unit: z.string().trim().max(12, "12 caractères maximum.").nullable(),
    createdAt: z.iso.datetime(),
    prerequisiteIds: z.array(id).max(20, "20 prérequis maximum."),
  })
  .refine((star) => star.secondaryDomainId !== star.domainId, {
    message: "Le second domaine doit être différent du premier.",
    path: ["secondaryDomainId"],
  })
  .refine((star) => !star.prerequisiteIds.includes(star.id), {
    message: "Un palier ne peut pas être son propre prérequis.",
    path: ["prerequisiteIds"],
  });

export const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(72),
});

export const idSchema = id;
export const idListSchema = z.array(id).max(200);
