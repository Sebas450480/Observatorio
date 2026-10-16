import { z } from 'zod';

/** Requisitos de una contraseña segura (iguales a los del servidor). */
export const REQUISITOS_CONTRASENA = [
  { texto: 'Mínimo 8 caracteres', cumple: (v: string) => v.length >= 8 },
  { texto: 'Una mayúscula', cumple: (v: string) => /\p{Lu}/u.test(v) },
  { texto: 'Una minúscula', cumple: (v: string) => /\p{Ll}/u.test(v) },
  { texto: 'Un número', cumple: (v: string) => /\d/.test(v) },
  { texto: 'Un carácter especial (! # $ % - _ .)', cumple: (v: string) => /[^\p{L}\d\s]/u.test(v) },
] as const;

export const AYUDA_CONTRASENA = 'Mínimo 8 caracteres, con mayúscula, minúscula, número y carácter especial';

/** Contraseña nueva: mínimo 8 caracteres con mayúscula, minúscula, número y carácter especial. */
export const esquemaContrasena = z
  .string()
  .max(72, 'Máximo 72 caracteres')
  .refine((v) => REQUISITOS_CONTRASENA.every((r) => r.cumple(v)), AYUDA_CONTRASENA);
