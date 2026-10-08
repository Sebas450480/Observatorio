import { z } from 'zod';

/** Valores de los tipos ENUM de la base de datos (Fase 1, paso 1). */
export const MODALIDADES = ['Virtual', 'Presencial', 'Hibrido'] as const;
export const ESTADOS = ['Activo', 'Inactivo'] as const;
export const TIPOS_EVENTO = ['Congreso', 'Hackathon', 'Foro', 'Cumbre', 'Seminario', 'Taller', 'Otro'] as const;
export const TIPOS_FARO = ['Becas', 'Convocatorias', 'Cursos', 'Talleres'] as const;
export const TAMANOS_EMPRESA = ['Micro', 'Pequeña', 'Mediana', 'Grande'] as const;
export const FRECUENCIAS_ALERTA = ['Inmediata', 'Semanal', 'Ninguna'] as const;
export const TIPOS_CONTENIDO = ['Flash', 'Faro', 'Empresa', 'Tendencia', 'Evento'] as const;
export const ACCIONES = ['Vista', 'Clic_acceder', 'Compartir'] as const;

export type TipoContenido = (typeof TIPOS_CONTENIDO)[number];

/** Texto opcional: convierte "" en null para poder borrar un valor. */
export const textoOpcional = (max?: number) => {
  const base = max ? z.string().trim().max(max) : z.string().trim();
  return base.transform((v) => (v === '' ? null : v)).nullish();
};

export const textoObligatorio = (max: number) => z.string().trim().min(1, 'Es obligatorio').max(max);

/** Fecha y hora ISO 8601 con zona horaria, p. ej. 2026-10-20T08:00:00-05:00. */
export const fechaHora = z.iso.datetime({ offset: true, message: 'Debe ser una fecha y hora ISO 8601 (AAAA-MM-DDTHH:MM:SS-05:00)' });

/** Fecha sin hora, AAAA-MM-DD. */
export const fecha = z.iso.date({ message: 'Debe ser una fecha AAAA-MM-DD' });

export const enlace = z.url({ message: 'Debe ser un enlace válido (https://...)' }).max(2000);

export const dinero = z.number().nonnegative().max(9_999_999_999.99);

export const idPositivo = z.coerce.number().int().positive();

export const listaIds = z.array(z.number().int().positive()).max(50);

/** Parámetro de consulta que puede venir una o varias veces (?categoria=1&categoria=2). */
export const listaIdsConsulta = z
  .union([idPositivo, z.array(idPositivo)])
  .transform((v) => (Array.isArray(v) ? v : [v]));

export const booleanoConsulta = z.enum(['true', 'false']).transform((v) => v === 'true');

export const correo = z.email({ message: 'Correo inválido' }).max(100).transform((v) => v.trim().toLowerCase());

/** Reglas mínimas de contraseña. */
export const contrasena = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(72, 'La contraseña no puede superar 72 caracteres');
