import { z } from "zod";
export const email = z
  .string()
  .trim()
  .email("Escribe un correo válido.")
  .max(254)
  .transform((v) => v.toLowerCase());
export const name = z
  .string()
  .trim()
  .min(2, "Escribe al menos 2 caracteres.")
  .max(80);
export const password = z
  .string()
  .min(10, "La contraseña debe tener al menos 10 caracteres.")
  .max(128);
export const homeSchema = z.object({
  name,
  address: z.string().trim().max(200),
  description: z.string().trim().max(500),
});
export const idSchema = z.string().uuid("Identificador inválido.");
