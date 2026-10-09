import type { Modalidad } from '../api/tipos';

/** Formatos de fechas, horas y valores en español de Colombia (hora de Bogotá). */
const ZONA = 'America/Bogota';

/** Las fechas sin hora (AAAA-MM-DD) se interpretan como día de Bogotá, no UTC. */
function aFecha(valor: string | Date): Date {
  if (valor instanceof Date) return valor;
  return /^\d{4}-\d{2}-\d{2}$/.test(valor) ? new Date(`${valor}T12:00:00-05:00`) : new Date(valor);
}

/** "20 de octubre de 2026" */
export function fechaLarga(valor: string | Date): string {
  return aFecha(valor).toLocaleDateString('es-CO', { timeZone: ZONA, day: 'numeric', month: 'long', year: 'numeric' });
}

/** "29 sep 2026" */
/** "2 de nov de 2026" (tarjetas del Faro Empresarial). */
export function fechaMedia(valor: string | Date): string {
  return aFecha(valor)
    .toLocaleDateString('es-CO', { timeZone: ZONA, day: 'numeric', month: 'short', year: 'numeric' })
    .replace(/\./g, '')
    .replace('sept', 'sep');
}

export function fechaCorta(valor: string | Date): string {
  return aFecha(valor)
    .toLocaleDateString('es-CO', { timeZone: ZONA, day: 'numeric', month: 'short', year: 'numeric' })
    .replace(/\./g, '')
    .replace(/ de /g, ' ')
    .replace('sept', 'sep');
}

/** "8:00 a. m." */
export function hora(valor: string | Date): string {
  return aFecha(valor).toLocaleTimeString('es-CO', { timeZone: ZONA, hour: 'numeric', minute: '2-digit', hour12: true });
}

/** "8:00 a. m. - 5:00 p. m." */
export function rangoHoras(inicio: string, fin: string | null): string {
  return fin ? `${hora(inicio)} - ${hora(fin)}` : hora(inicio);
}

/** Día y mes abreviado para las fechas de las listas: { dia: '13', mes: 'OCT' }. */
export function diaMes(valor: string | Date): { dia: string; mes: string } {
  const fecha = aFecha(valor);
  return {
    dia: fecha.toLocaleDateString('es-CO', { timeZone: ZONA, day: 'numeric' }),
    mes: fecha.toLocaleDateString('es-CO', { timeZone: ZONA, month: 'short' }).replace('.', '').toUpperCase(),
  };
}

/** "1.240" */
export function numero(valor: number): string {
  return valor.toLocaleString('es-CO');
}

/** "GRATUITO" o "$150.000 COP" */
export function costo(valor: number | null, esGratuito: boolean): string {
  if (esGratuito || !valor) return 'GRATUITO';
  return `$${valor.toLocaleString('es-CO', { maximumFractionDigits: 0 })} COP`;
}

export function modalidadTexto(modalidad: Modalidad | null | undefined): string {
  if (modalidad === 'Hibrido') return 'Presencial y virtual';
  return modalidad ?? '';
}

/** Valor para <input type="date"> a partir de una fecha ISO (día de Bogotá). */
export function aEntradaFecha(valor: string | null | undefined): string {
  if (!valor) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
  return new Date(valor).toLocaleDateString('en-CA', { timeZone: ZONA });
}

/** Valor para <input type="time"> a partir de una fecha ISO (hora de Bogotá). */
export function aEntradaHora(valor: string | null | undefined): string {
  if (!valor) return '';
  return new Date(valor).toLocaleTimeString('en-GB', { timeZone: ZONA, hour: '2-digit', minute: '2-digit' });
}

/** Une fecha (AAAA-MM-DD) y hora (HH:MM) de Bogotá en ISO 8601 con zona. */
export function aIsoBogota(fecha: string, horaTexto: string): string {
  return `${fecha}T${horaTexto || '00:00'}:00-05:00`;
}

/** Iniciales para el avatar: "Andrés Martínez" -> "AM". */
export function iniciales(nombre: string, apellido: string): string {
  return `${nombre.trim()[0] ?? ''}${apellido.trim()[0] ?? ''}`.toUpperCase();
}

/** Texto en viñetas (una por línea) a lista. */
export function vinetas(texto: string | null): string[] {
  if (!texto) return [];
  return texto
    .split('\n')
    .map((linea) => linea.replace(/^[•\-*]\s*/, '').trim())
    .filter(Boolean);
}

/** Tipo de evento para mostrar: el nombre escrito cuando se eligió "Otro". */
export function nombreTipoEvento(e: { tipo_evento: string; tipo_otro?: string | null }): string {
  return e.tipo_evento === 'Otro' && e.tipo_otro ? e.tipo_otro : e.tipo_evento;
}
