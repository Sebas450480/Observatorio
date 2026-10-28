import { z } from 'zod';

/** Valores de los tipos ENUM de la base de datos (Fase 1, paso 1). */
export const MODALIDADES = ['Virtual', 'Presencial', 'Hibrido'] as const;
export const ESTADOS = ['Activo', 'Inactivo'] as const;
export const TIPOS_EVENTO = ['Congreso', 'Hackathon', 'Foro', 'Cumbre', 'Seminario', 'Taller', 'Feria', 'Otro'] as const;
export const TIPOS_FARO = ['Becas', 'Convocatorias', 'Cursos', 'Talleres'] as const;
export const TAMANOS_EMPRESA = ['Micro', 'Pequeña', 'Mediana', 'Grande'] as const;
// «Inmediata» ya no se ofrece: las cuentas que la tenían pasaron a «Diaria» (el valor sigue en la base).
export const FRECUENCIAS_ALERTA = ['Diaria', 'Cada2Dias', 'Semanal', 'Ninguna'] as const;
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

/** Máximo de intereses que se eligen en cada módulo. */
export const MAXIMO_INTERESES = 5;

/** Intereses de Faro (categorías): hasta 5. */
export const interesesFaro = z.array(z.number().int().positive()).max(MAXIMO_INTERESES, `Elige máximo ${MAXIMO_INTERESES} intereses en Faro`);

const listaPreferencias = (modulo: string) =>
  z.array(z.string().trim().min(1).max(100)).max(MAXIMO_INTERESES, `Elige máximo ${MAXIMO_INTERESES} intereses en ${modulo}`);

/** Intereses de los demás módulos: tipos de evento (Flash), sectores (Empresa) y megatendencias (Tendencia). */
export const esquemaPreferencias = z.object({
  Flash: listaPreferencias('Flash Informativo').optional(),
  Empresa: listaPreferencias('Empresas coformadoras').optional(),
  Tendencia: listaPreferencias('Tendencias').optional(),
});
export type Preferencias = z.infer<typeof esquemaPreferencias>;

/** Parámetro de consulta que puede venir una o varias veces (?categoria=1&categoria=2). */
export const listaIdsConsulta = z
  .union([idPositivo, z.array(idPositivo)])
  .transform((v) => (Array.isArray(v) ? v : [v]));

export const booleanoConsulta = z.enum(['true', 'false']).transform((v) => v === 'true');

export const correo = z.email({ message: 'Correo inválido' }).max(100).transform((v) => v.trim().toLowerCase());

/**
 * Contraseña segura para cuentas nuevas y cambios de contraseña: mínimo 8 caracteres,
 * con mayúscula, minúscula, número y carácter especial. (El inicio de sesión no la
 * revisa, para que las cuentas con contraseñas anteriores puedan entrar.)
 */
export const contrasena = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(72, 'La contraseña no puede superar 72 caracteres')
  .regex(/\p{Lu}/u, 'La contraseña debe tener al menos una mayúscula')
  .regex(/\p{Ll}/u, 'La contraseña debe tener al menos una minúscula')
  .regex(/\d/, 'La contraseña debe tener al menos un número')
  .regex(/[^\p{L}\d\s]/u, 'La contraseña debe tener al menos un carácter especial (p. ej. ! # $ % - _ .)');

/** Nombre para comparar duplicados: sin tildes, en minúsculas y sin espacios repetidos. */
export const normalizarNombre = (texto: string) =>
  texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim().replace(/\s+/g, ' ');

/** Siglas que se conservan en mayúscula al dar formato de oración (IoT conserva su forma). */
const SIGLAS = new Map(
  ['IA', 'AI', 'ESG', 'TIC', 'TICS', 'B2B', 'B2C', 'D2C', 'PYME', 'PYMES', 'MIPYME', 'MIPYMES', 'ODS', 'RSE', 'KPI', 'CRM', 'ERP', 'ONG', 'API', 'UX', 'UI',
   'VR', 'AR', 'NFT', 'PIB', 'SENA', 'DANE', 'BPO', 'SAAS', 'IOT', '5G', '3D', 'ADN', 'LGBTIQ+', 'CO2']
    .map((s) => [s, s === 'IOT' ? 'IoT' : s === 'SAAS' ? 'SaaS' : s === 'TICS' ? 'TICs' : s]),
);

/**
 * Formato de oración: solo la primera letra en mayúscula y el resto en minúscula, conservando
 * las siglas conocidas ("VIDEO MARKETING" -> "Video marketing", "ia generativa" -> "IA generativa").
 */
export function formatoOracion(texto: string): string {
  const palabras = texto.trim().replace(/\s+/g, ' ').split(' ').map((palabra) => {
    const nucleo = palabra.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}+]+$/gu, '');
    const sigla = SIGLAS.get(nucleo.toLocaleUpperCase('es'));
    return sigla ? palabra.replace(nucleo, sigla) : palabra.toLocaleLowerCase('es');
  });
  const frase = palabras.join(' ');
  // Primera letra (después de signos como «¿» o comillas) en mayúscula.
  return frase.replace(/\p{L}/u, (letra) => letra.toLocaleUpperCase('es'));
}

/** Acciones de la selección múltiple de las tablas (hasta 100 registros, una página). */
export const esquemaLote = z.object({
  ids: z.array(idPositivo).min(1, 'Selecciona al menos un registro').max(100, 'Máximo 100 registros a la vez'),
  accion: z.enum(['eliminar', 'activar', 'desactivar']),
});
