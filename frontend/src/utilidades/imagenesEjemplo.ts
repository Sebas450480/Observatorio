import type { Empresa, Faro, Flash } from '../api/tipos';

/**
 * Fotos de ejemplo para los registros sin imagen: una por tipo de evento (Flash), por tipo de
 * oportunidad (Faro) y por sector (empresas). Son fotos libres (CC0, StockSnap) guardadas en la
 * carpeta ejemplos/ del bucket público de Supabase Storage. La base de datos no cambia: en
 * cuanto un gestor sube una foto, se muestra esa.
 */
const BASE = 'https://brobinraqmjepzqnumrq.supabase.co/storage/v1/object/public/imagenes/ejemplos';
/** Sube este número al reemplazar las fotos, para que los navegadores no muestren las anteriores. */
const VERSION = 2;

const clave = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const TIPOS_EVENTO = ['congreso', 'hackathon', 'foro', 'cumbre', 'seminario', 'taller', 'feria'];
const TIPOS_FARO = ['becas', 'convocatorias', 'cursos', 'talleres'];

/** Sector escrito por el gestor → foto del grupo de sectores que más se parece. */
const SECTORES: [RegExp, string][] = [
  [/tecnolog|software|informatic|sistemas|digital|telecom/, 'tecnologia'],
  [/salud|medic|clinic|farmac|hospital|odonto/, 'salud'],
  [/educa|formaci|universi|colegio|academ|capacita/, 'educacion'],
  [/construc|inmobili|arquitect|obra|ingenier/, 'construccion'],
  [/agro|agric|ganad|pecuar|flor|cafe|campo/, 'agro'],
  [/financ|banc|seguro|contab|credito|inversi/, 'finanzas'],
  [/turism|hotel|restaur|gastronom|viaje|alimento|bebida/, 'turismo'],
  [/transport|logist|distribu|almacen|envio/, 'transporte'],
  [/industr|manufactur|fabric|metal|quimic|textil|plastic|producci/, 'industria'],
  [/comerci|tienda|venta|retail|almacenes|mayorista|minorista/, 'comercio'],
  [/servicio|consultor|asesor|outsourc|marketing|publicidad|legal/, 'servicios'],
];

export function imagenFlash(f: Pick<Flash, 'imagen' | 'tipo_evento'>): string {
  if (f.imagen) return f.imagen;
  const tipo = clave(f.tipo_evento);
  return `${BASE}/flash-${TIPOS_EVENTO.includes(tipo) ? tipo : 'otro'}.jpg?v=${VERSION}`;
}

export function imagenFaro(f: Pick<Faro, 'imagen' | 'tipo'>): string {
  if (f.imagen) return f.imagen;
  const tipo = clave(f.tipo);
  return `${BASE}/faro-${TIPOS_FARO.includes(tipo) ? tipo : 'convocatorias'}.jpg?v=${VERSION}`;
}

export function imagenEmpresa(e: Pick<Empresa, 'imagen_portada' | 'sector_economico'>): string {
  if (e.imagen_portada) return e.imagen_portada;
  const sector = clave(e.sector_economico ?? '');
  return `${BASE}/empresa-${SECTORES.find(([patron]) => patron.test(sector))?.[1] ?? 'general'}.jpg?v=${VERSION}`;
}
