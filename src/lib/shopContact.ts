import { z } from "zod";

/** The three business details every shop must give. Used by the settings API and by the public policy pages. */
export const contactSchema = z.object({
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s()-]/g, ""))
    .refine((v) => /^\+?\d{10,13}$/.test(v), "Enter a valid phone number, 10 to 13 digits"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(120),
  address: z.string().trim().min(10, "Enter the full shop address (at least 10 characters)").max(300),
});

export type ShopContact = z.infer<typeof contactSchema>;

/** True when all three details are saved and valid. */
export function isContactComplete(c: { contactEmail?: string | null; contactPhone?: string | null; contactAddress?: string | null } | null | undefined): boolean {
  if (!c) return false;
  return contactSchema.safeParse({ phone: c.contactPhone ?? "", email: c.contactEmail ?? "", address: c.contactAddress ?? "" }).success;
}
